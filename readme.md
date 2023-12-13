# The EpiVar Browser

A web application to search for eQTL/epigenetic signal-associated variants and 
merge bigWig tracks by genotype. A production instance with data from 
Aracena *et al.* 
([2022 preprint](https://www.biorxiv.org/content/10.1101/2022.05.10.491413v1)) 
is available at 
[https://computationalgenomics.ca/tools/epivar](https://computationalgenomics.ca/tools/epivar). 



## Table of Contents

<!-- TOC -->
* [The EpiVar Browser](#the-epivar-browser)
  * [Table of Contents](#table-of-contents)
  * [Installation](#installation)
    * [Note on hosting your own instance](#note-on-hosting-your-own-instance)
    * [Dependencies](#dependencies)
    * [Setting up the Postgres database](#setting-up-the-postgres-database)
    * [Application data](#application-data)
    * [Authorization (Identity provider)](#authorization-identity-provider)
    * [Application](#application)
      * [Development (Aracena *et al.*-specific)](#development-aracena-et-al-specific)
      * [Production](#production)
        * [Note on current deployment for Aracena *et al.*](#note-on-current-deployment-for-aracena-et-al)
    * [Editing site text content](#editing-site-text-content)
  * [Architecture](#architecture)
<!-- TOC -->



## Installation

### Note on hosting your own instance

With some effort, the EpiVar browser can be deployed with other data than just
the Aracena *et al.* dataset. The instructions below must be followed,
paying especially close attention to the formats described in the 
[Application data](#application-data) section.

This application is **NOT** meant as a purely plug-and-play solution. Instead, 
it serves as a starting point, both in approach and with our free and 
open-source codebase,  for those who wish to present a similar dataset and 
interface.


### Dependencies

Install these dependencies according to their own instructions:
 - NodeJS version 16+
 - Postgres 
   - Used for storing SNPs, features, associations (p-values), and other metadata.
   - Tested with versions 13 through 15.
   - See [Setting up the Postgres database](#setting-up-the-postgres-database) for how to prepare this.
 - Redis
   - Used for caching values
   - Tested with version 6+
   - note that a Redis instance should never be exposed to the internet! 
     EpiVar expects it to be available locally at `localhost:6379`; the default Redis port.
 - `bigWigMergePlus`: https://github.com/c3g/kent/releases/download/bigWigMergePlus_v2.3.2/bigWigMergePlus-mp2b
 - `bigWigSummary`: http://hgdownload.soe.ucsc.edu/admin/exe/linux.x86_64/
 - `gemini`: https://gemini.readthedocs.io/en/latest/ (non-trivial, takes some effort, there is a lot of data to download)

Executables must be on the `PATH` of the application to be called directly.


### Setting up the Postgres database

After Postgres is installed, you should create a user (with a password) 
and database for the application.

For example, starting with a `bash`/similar command-line shell and the 
default `postgres` user, you can access a Postgres shell:

```bash
sudo su - postgres
psql
```

You should now be connected to Postgres:

```postgresql
CREATE USER epivar WITH PASSWORD 'my-password';
CREATE DATABASE epivar_db WITH OWNER epivar;
```

To exit out of the Postgres session / `postgres` user `bash` session, 
hit `Control-d` twice.


### Application data

The application requires data from multiple different sources. The data
must also be transformed to be consumable by the application. The first step
is therefore to prepare the data. 

> `./input-files` contains portions of the source data for the 
> Aracena *et al.* instance of the portal, as provided by Alain Pacis.
> These files can serve as a starting point or examples of formatting 
> for customizing the portal.

The data directory is configurable but the application and this document
will use `./data` by default for generated file data. Data inserted into the
Postgres database ends up wherever Postgres is configured to persist data to.

**Start with** `cp config.example.js config.js` to create the required config.
The default config should not need updating if you follow the instructions below,
but you can follow along to make sure everything matches. 

The different data sources to generate/prepare are:

 - **Condition and ethnicity configuration:** Set up conditions/treatments and
   sample population groups/ethnicities for the portal in `config.js` in the 
   `config.source.conditions` and `config.source.ethnicities` arrays:
   - **Format:** *(example)*
     ```javascript
     module.exports = {
       // ...
       source: {
         // ...
         conditions: [
           {id: "NI", name: "Non-infected"},
           {id: "Flu", name: "Flu"},
         ],
         ethnicities: [
           {id: "AF", name: "African-American", plotColor: "#5100FF", plotBoxColor: "rgba(81, 0, 255, 0.6)"},
           {id: "EU", name: "European-American", plotColor: "#FF8A00", plotBoxColor: "rgba(255, 138, 0, 0.6)"},
         ],
       },
       // ...
     };
     ```
    - **Note:** While the field is called `ethnicities`, this can in fact be used for 
      non-ethnicity population groups as well. It is just used to visually separate points 
      in the box plots generated by the server.

 - **Metadata:** This is the track's metadata. This can either be provided as an
   XLSX file with the headers:
     - `file.path`: relative path to `bigWig`, without `config.paths.tracks` directory prefix
     - `ethnicity`: ethnicity / population group **ID** (*not* name!) 
       - if set to `Exclude sample`, sample will be skipped
     - `condition`: condition / experimental group **ID** (*not* name!)
     - `sample_name`: Full sample name, uniquely indentifying the sample within 
       `assay`, `condition`, `donor`, and `track.view` variables
     - `donor`: donor ID (i.e., individual ID)
     - `track.view`: literal value, one of `signal_forward` or `signal_reverse`
     - `track.track_type`: literal value `bigWig`
     - `assembly.name`: assembly name (e.g., `hg19`).
     - `assay.name`: one of `RNA-Seq`, `ATAC-Seq`, `H3K27ac`, `H3K4me1`, `H3K27me3`, `H3K4me3`
   
   and the sheets (which match `assay.name`):
     - RNA-Seq
     - ATAC-Seq
     - H3K27ac
     - H3K4me1
     - H3K27me3
     - H3K4me3
 
   or a JSON file containing a list of objects with the following keys, 
   mapping to the above headers in order:
     - `path`
     - `ethnicity`
     - `condition`
     - `sample_name`
     - `donor`
     - `view`
     - `type`
     - `assembly`
     - `assay`
 
   Information on the track metadata file:
     - **Generate with:** `node ./scripts/metadata-to-json.js ./input-files/flu-infection.xlsx` 
       - Replace `./input-files/flu-infection.xlsx` with the path to your metadata file
       - Optionally, the resulting JSON can just be generated directly (see above for keys)
     - **Config:** `config.source.metadata.path` (filepath)
     - **Input:** `./input-files/flu-infection.xlsx` 
       - Or, whichever metadata file you specify in `config.js`
     - **Output:** `./data/metadata.json` (*or, just generate this file directly*)
     - **Notes:** This is really just an XLSX to JSON transformation. 
       The version of the XLSX used for the Aracena *et al.* portal 
       instance is available in this repository as a reference.

 - **Pre-computed feature signals:** Optionally, preset matrices can be provided
   with point values for box plots that have been batch-corrected and, e.g., 
   age-regressed.
     - **Import with:** N/A *(Automatically read with the below Genes and 
       Peaks import steps!)*
     - **Input:** A set of matrix files. These are TSV-formatted, with a header 
       row for sample names (`{ethnicity}##_{condition}`, e.g., `EU99_Flu`) and 
       a header column at the start for feature names (`chr#_startpos_endpos` 
       or `GENESYMBOL`).
     - **Config:** Use the `VARWIG_POINTS_TEMPLATE` environment variable to 
       configure where point matrices are loaded from. The `$ASSAY` string is 
       replaced with each assay in turn. 
       *Defaults to:* `./input-files/matrices/$ASSAY_batch.age.corrected_PCsreg.txt`
     - **Notes:** In our EpiVar instance, the corrections applied are:
        - Batch correction
        - Age regressed out as a cofactor
        - Principal components regression

 - **Genes:** lists of gene names mapped to their characteristics, and features 
   associated with specific genes.
     - **Import with:** `node ./scripts/import-genes.js`
     - **Input:** `./input-files/flu-infection-genes.txt` and 
       `./input-files/flu-infection-gene-peaks.csv` 
       - Examples for these files / the versions used for the Aracena *et al.* instance 
         of the portal are already [in the repository](./input-files).
     - **Format:**
       - `flu-infection-genes.txt`: TSV file with *no header row*. Columns are: 
         gene name, chromosome with `chr` prefix, start coordinate, end coordinate,
         strand (`+` or `-`).
       - `flu-infection-gene-peaks.csv`: CSV *with header row*:
         `"symbol","peak_ids","feature_type"` where `symbol` is gene name, `peak_ids`
         is a feature string (e.g., `chr1_9998_11177`), and `feature_type` is the name
         of the assay.
     - **Notes:** The `name` column contains their name as provided in the input file,
       however there are inconsistencies in the notation of names, where sometimes
       the `.` and `-` will diverge from one source to another. Therefore, names are
       normalized by replacing all non-digits/non-letters with `-`, and that is the
       unique `name_norm` column used for genes.
 
 - **Peaks:** list of peaks names mapped to their characteristics. These files 
   are CSVs which have the following headers:
     - `rsID`: The rsID of the SNP
     - `snp`: The SNP in the SNP-peak association; formatted like `chr#_######`
       (UCSC-formatted chromosome name, underscore, position)
     - `feature`: The feature name - either `chr#_startpos_endpos` or `GENE_NAME`
     - `pvalue.*` where `*` is the ID of the condition (by default, `*` = `NI` then `Flu`) 
         - These are floating point numbers
     - `feature_type`: The assay the peak is from - e.g., `RNA-seq`
   
   Information on the QTL/peak list files:
     - **Import with:** `node ./scripts/import-peaks.js` followed by 
       `node ./scripts/calculate-peak-groups.js`
     - **Input:** `./input-files/qtls/QTLS_complete_*.csv` (there are a couple 
       truncated example files in [`./input-files/qtls`](./input-files/qtls))
     - **Config:** Use the `VARWIG_QTLS_TEMPLATE` environment variable to configure
       where QTL lists are loaded from. The `$ASSAY` string is replaced with each 
       assay in turn. *Defaults to:* `./input-files/qtls/QTLs_complete_$ASSAY.csv`
     - **Notes:** The peak's associated feature is usually different from where the
      peak position is; e.g., the peak SNP can be at `chr1:1000`, but the feature is
      at the range `chr1:3500-3600`. The second script calculates peak groups by SNP
      and gene for auto-complete.
 
 - **Binned top peaks for assays:** Used to generate Manhattan plots for
   chromosome/assay pairs, binned by SNP position.
     - **Generate with:** `node ./scripts/calculate-top-peaks.js`
     - **Notes:** This will populate a table in the Postgres database.
 
 - **Tracks:** There are pre-generated bigWig files that contain the signal data 
   to use for merging and displaying in the browser. The paths should correspond to 
     - **Config:** `VARWIG_TRACKS_DIR` environment variable, specifying the directory
     - **Notes:** A metadata item (from step Metadata above) `.path` field
       points to a path inside the `config.paths.tracks` directory, eg:
       `metadata.path = 'RNAseq/AF02_Flu.forward.bw'`
       `filepath = path.join(config.paths.tracks, metadata.path)`
     - **EpiVar-specific notes:** You will need to either copy the files, or
       in development mount them with `sshfs` to have access to them.
 
 - **Merged tracks:** The directory to store the merged tracks.
     - **Generate with:** `mkdir -p ./data/mergedTracks`
         - This location can be changed with the environment variable `VARWIG_MERGED_TRACKS_DIR`
     - **Config:** `VARWIG_MERGED_TRACKS_DIR` environment variable or `config.paths.mergedTracks` (directory)
     - **Notes:** Make sure there is enough space for those tracks.
 
 - **GEMINI database:** This contains variants' data.
     - **Generate with:** Follow instructions on the 
       [GEMINI](https://gemini.readthedocs.io/en/latest/)  website for information 
       on creating a GEMINI database from a VCF. 
       For Aracena *et al.* data, copy it or mount over `sshfs`.
     - **Notes for Aracena *et al.* implementation:** 
       Accessing it over `sshfs` in development is slow because the
       `gemini` command needs to read it a lot. It might be easier to call
       `gemini` directly on `beluga`. See the comment in `./models/samples.mjs`
       about the `gemini()` function for more details.
       Fetching the chromosomes list can also be expensive, so for development
       you might want to hardcode the list in the config at
       `config.development.chroms` once you know what that list is.


### Authorization (Identity provider)

The EpiVar browser uses OpenID Connect (OIDC) for authentication/authorization (auth).
It does not include its own username/password/identity layer.

A popular (free for small projects) provider for OIDC is [Auth0](https://auth0.com/).

For academic projects, [CILogon](https://www.cilogon.org/) is an excellent choice
which can federate to different academic institutions' own auth systems.

When configuring EpiVar, one must set various parameters for the OIDC identity provider
in the `.env` file (see the [Production](#production) section below.)


### Application

Once the data are ready, you can install & build the application as follows:

```sh
npm run install
# Builds the frontend and copies it under ./public
npm run build
```


#### Development (Aracena *et al.*-specific)

To enable remote `gemini` execution:

```bash
export EXECUTE_GEMINI_REMOTELY=true
```

To use `sshfs` to mount the bigWigs from `beluga` or `narval`:

```bash
# Either
sshfs -o defer_permissions \
  beluga.computecanada.ca:/lustre03/project/rrg-bourqueg-ad/C3G/projects/DavidB_varwig/ \
  /path/to/local/mnt
# Or
sshfs -o defer_permissions \
  narval.computecanada.ca:/lustre03/project/rrg-bourqueg-ad/C3G/projects/DavidB_varwig/ \
  /path/to/local/mnt
```

In development, you'd run:
 - `npm run watch`: for the backend
 - `cd client && npm start`: for the frontend


#### Production

In production, you may need to set up these to handle persistence & HTTPS:
 - Set up an NGINX or Apache proxy with a LetsEncrypt certificate
   (see [./nginx.conf](./nginx.conf) for an example.)
    - For the reference deployment, we are using a VM behind a proxy. We needed to set
      the following NGINX configuration values: `real_ip_header X-Forwarded-For;` and 
      `set_real_ip_from ####;`, where `####` is the IP block for the hypervisor from the 
      VM's perspective, in order to get correct `X-Real-IP` values for the terms of use 
      agreement.
 - Set up Redis to handle caching
 - Set up Postgres to handle persistent data
    - In production, make sure to configure Postgres with **lots of RAM** and 4+ workers for gathers! 
      Otherwise, autocomplete queries will be really slow.
 - Set up `pm2` to run `node ./bin/www` with multiple workers 
   (e.g. `pm2 start ./bin/www --name epivar -i 0`)

You will also need to set up authentication via an OIDC layer. This is configured via
environment variables (which can either be typed into the service run command, or placed
into a `.env` file and loaded at service start time).

Here is an example, with secrets redacted, for a setup via Auth0, 
complete with directory and Postgres configuration as well:

```bash
# Auth configuration
VARWIG_AUTH_SCOPE="openid profile"
VARWIG_CLIENT_ID=some_client
VARWIG_CLIENT_SECRET=some_secret
VARWIG_SESSION_SECRET=some_session_secret
VARWIG_ISSUER=https://dev-###.us.auth0.com/
VARWIG_AUTH_URL=https://dev-###.us.auth0.com/authorize
VARWIG_TOKEN_URL=https://dev-###.us.auth0.com/oauth/token
VARWIG_USERINFO_URL=https://dev-###.us.auth0.com/userinfo
# Other Varwig configuration
VARWIG_BASE_URL=https://flu-infection.vhost38.genap.ca
# Database configuration
VARWIG_PG_CONNECTION=postgres://epivar@localhost:5432/epivar_db
# Directories
VARWIG_MERGED_TRACKS_DIR=/flu-infection-data/mergedTracks
VARWIG_TRACKS_DIR=/flu-infection-data
VARWIG_GEMINI_DB=/flu-infection-data/allSamples_WGS.gemini.db
```

Note that trailing slashes are very important here; for example, a missing trailing slash for `VARWIG_ISSUER` will
prevent successful authentication.

In production with CILogon, the auth scopes would be configured as follows:

```bash
VARWIG_AUTH_SCOPE="openid email org.cilogon.userinfo"
```

##### Note on current deployment for Aracena *et al.*

We use `pm2` to run multiple processes of the application at a time to handle more simultaneous requests.
The `PM2_HOME` folder is set to `/home/dlougheed/.pm2` currently (sorry).


### Editing site text content

The instance title and subtitle can be configured at
[`./client/src/constants/app.js`](./client/src/constants/app.js).

Page content is stored as JSX components in [`./client/src/components/pages`](./client/src/components/pages).
When deploying a new instance, make sure to change these pages from the default!



## Architecture

This is a standard express backend + react frontend application. Frontend files
live in `./client`, and backend files live at the root of the project.

The API routes are set up in [app.mjs](./app.mjs), and are listed in [routes/](./routes);
the frontend groups all API communication functions in [./client/src/api.js](./client/src/api.js).
The [models/](./models) folder contains the functions to retrieve the actual data,
depending on where it is. Some of it is in Postgres databases (genes, peaks, sessions); the tracks
come from the `tracks/mergedTracks` folders configured previously, the variants (aka samples) data
comes from `gemini`, and the UCSC track hubs are generated on the fly.

**Note that all code should be written with the assumption that multiple processes can run at a time.**
Thus, Redis/Postgres should generally be used for any cached/persistent data.

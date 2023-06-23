# The EpiVar Browser

A web application to search for variants and merge bigWig tracks; available at 
[https://flu-infection.vhost38.genap.ca/](https://flu-infection.vhost38.genap.ca/). 

If linking publicly, **use the permalink**: 
[https://computationalgenomics.ca/tools/epivar](https://computationalgenomics.ca/tools/epivar).

## Installation

### Dependencies

Install these dependencies according to their own instructions:
 - `nodejs`
 - `postgres` 
 - `bigWigMergePlus`: https://github.com/c3g/kent/releases/download/bigWigMergePlus_v2.3.2/bigWigMergePlus-mp2b
 - `bigWigInfo` and `bigWigSummary`: http://hgdownload.soe.ucsc.edu/admin/exe/linux.x86_64/
 - `gemini`: https://gemini.readthedocs.io/en/latest/ (non-trivial, takes some effort, there is a lot of data to download)

Executables must be on the `PATH` of the application to be called directly.

### Application data

The application requires data from multiple different sources. The data
is also transformed to be consumable by the application. The first step
is therefore to prepare the data. `./input-files` contain the source data
at time of writing as provided by Alain Pacis, but may need to be updated.
The data directory is configurable but the application and this document
will use `./data` by default for generated file data. Data inserted into the
Postgres database ends up wherever Postgres is configured to persist data to.

**Start with** `cp config.example.js config.js` to create the required config.
The default config should not need updating if you follow the instructions below,
but you can follow along to make sure everything matches. Make sure `./data`
exists with `mkdir -p ./data`.

The different data sources to generate/prepare are:

 - **Condition and ethnicity configuration:** Set up conditions/treatments and
   sample ethnicities for the portal in `config.js` in the 
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
 - **Genes:** list of gene names mapped to their characteristics.
     - **Import with:** `node ./scripts/import-genes.js`
     - **Input:** `./input-files/flu-infection-genes.txt`
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
     - **Import with:** `node ./scripts/import-peaks.js` followed by `node ./scripts/calculate-peak-groups.js`
     - **Input:** `./input-files/qtls/QTLS_complete_*.csv`
     - **Config:** Use the `VARWIG_QTLS_TEMPLATE` environment variable to configure
       where QTL lists are loaded from. The `$ASSAY` string is replaced with each 
       assay in turn. *Defaults to:* `./input-files/qtls/QTLs_complete_$ASSAY.csv`
     - **Notes:** The peak's associated feature is usually different from where the
      peak position is; e.g., the peak SNP can be at `chr1:1000`, but the feature is
      at the range `chr1:3500-3600`. The second script calculates peak groups by SNP
      and gene for auto-complete.
 
 - **Metadata:** This is the track's metadata. This can either be provided as an 
   XLSX file with the headers:
     - `file.path`
     - `ethnicity`
     - `condition`
     - `institution.short_name`
     - `sample_name`
     - `donor`
     - `track.view`
     - `track.track_type`
     - `assembly.name`
     - `assay.name`
     - `assay_category.name`
   
   or a JSON file containing a list of objects with (similar) keys:
     - `path`
     - `ethnicity`
     - `condition`
     - `short_name`
     - `sample_name`
     - `donor`
     - `view`
     - `type`
     - `assembly`
     - `assay`
     - `assay_id`
     - `assay_category`
     - `assay_category_id`
   
   Information on the track metadata file:
     - **Generate with:** `node ./scripts/metadata-to-json.js`
     - **Input:** `./input-files/flu-infection.xlsx`
     - **Output:** `./data/metadata.json`
     - **Config:** `config.source.metadata.path` (filepath)
     - **Notes:** This is really just an XLSX to JSON transformation.
 
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
 
 - **Gemini database:** This contains variants' data.
     - **Generate with:** Copy it or mount over `sshfs`.
     - **Notes:** Accessing it over `sshfs` in development is slow because the
       `gemini` command needs to read it a lot. It might be easier to call
       `gemini` directly on `beluga`. See the comment in `./models/samples.mjs`
       about the `gemini()` function for more details.
       Fetching the chromosomes list can also be expensive, so for development
       you might want to hardcode the list in the config at
       `config.development.chroms` once you know what that list is.

### Application

Once the data is ready, you can install & build the application as follows:

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
 - Set up nginx or apache proxy (see `./nginx.conf`) with LetsEncrypt certificate
 - Set up Redis to handle caching
 - Set up Postgres to handle persistent data
    - In production, make sure to configure Postgres with **lots of RAM** and 4+ workers for gathers! 
      Otherwise, autocomplete queries will be really slow.
 - Set up `pm2` to run `node ./bin/www` with multiple workers 
   (e.g. `pm2 start ./bin/www --name epivar -i 0`)

You will also need to set up authentication via an OIDC layer. This is configured via
environment variables (which can either be typed into the service run command, or placed
into a `.env` file and loaded at service start time).

Here is an example, with secrets redacted, for a setup via Auth0:

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
VARWIG_PG_CONNECTION=postgres://davidlougheed@localhost:5432/flu_infection_db
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

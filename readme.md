# The EpiVar Browser

A web application to search for variant and merge bigWig tracks.

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

 - **Genes:** list of gene names mapped to their characteristics.
     - **Import with:** `node ./scripts/import-genes.js`
     - **Input:** `./input-files/flu-infection-genes.txt`
     - **Notes:** The `name` column contains their name as provided in the input file,
       however there are inconsistencies in the notation of names, where sometimes
       the `.` and `-` will diverge from one source to another. Therefore, names are
       normalized by replacing all non-digits/non-letters with `-`, and that is the
       unique `name_norm` column used for genes.
 
 - **Peaks:** list of peaks names mapped to their characteristics.
     - **Import with:** `node ./scripts/import-peaks.js`
     - **Input:** `./input-files/QTLS_complete_*.csv`
     - **Notes:** The peak's associated feature is usually different from where the
      peak position is. Eg, the peak can be at `chr1:1000`, but the feature is
      at the range `chr1:3500-3600`
 
 - **Metadata:** This is the track's metadata
     - **Generate with:** `node ./scripts/metadata-to-json.js`
     - **Input:** `./input-files/flu-infection.xlsx`
     - **Data:** `./data/metadata.json`
     - **Config:** `config.source.metadata.path` (filepath)
     - **Notes:** This is really just an XLSX to JSON transformation.
 
 - **Tracks:** There are the bigWig files that contain the signal data.
     - **Generate with:** You will need to either copy the files, or
       in development mount them with `sshfs` to have access to them.
       See comment inside `config.example.js` for more details.
     - Config: `config.paths.tracks` (directory)
     - Notes: A metadata item (from step Metadata above) `.path` field
       points to a path inside the `config.paths.tracks` directory, eg:
       `metadata.path = 'RNAseq/AF02_Flu.forward.bw'`
       `filepath = path.join(config.paths.tracks, metadata.path)`
 
 - Merged tracks: The directory to store the merged tracks.
     - **Generate with:** `mkdir -p ./data/mergedTracks`
     - **Config:** `config.paths.mergedTracks` (directory)
     - **Notes:** Make sure there is enough space for those tracks.
 
 - Gemini database: This contains variants' data.
     - **Generate with:** Copy it or mount over `sshfs`.
     - **Notes:** Accessing it over `sshfs` in development is slow because the
       `gemini` command needs to read it a lot. It might be easier to call
       `gemini` directly on `beluga`. See the comment in `./models/samples.mjs`
       about the `gemini()` function for more details.
       Fetching the chromosomes list can also be expensive, so for development
       you might want to hardcode the list in the config at
       `config.development.chroms` once you know what that list is.

### Application

Once the data is read, you can install & build the application as follows:

```sh
npm run install
# Builds the frontend and copies it under ./public
npm run build
```

#### Development

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
VARWIG_AUTH_SCOPE="openid profile"
VARWIG_CLIENT_ID=some_client
VARWIG_CLIENT_SECRET=some_secret
VARWIG_SESSION_SECRET=some_session_secret
VARWIG_ISSUER=https://dev-###.us.auth0.com/
VARWIG_AUTH_URL=https://dev-###.us.auth0.com/authorize
VARWIG_TOKEN_URL=https://dev-###.us.auth0.com/oauth/token
VARWIG_USERINFO_URL=https://dev-###.us.auth0.com/userinfo
VARWIG_BASE_URL=https://flu-infection.vhost38.genap.ca
```

Note that trailing slashes are very important here; for example, a missing trailing slash for `VARWIG_ISSUER` will
prevent successful authentication.

In production with CILogon, the auth scopes would be configured as follows:

```bash
VARWIG_AUTH_SCOPE="openid email org.cilogon.userinfo"
```

We use `pm2` to run multiple processes of the application at a time to handle more simultaneous requests.
The `PM2_HOME` folder is set to `/home/dlougheed/.pm2` currently (sorry).

**Note that all code should be written with the assumption that multiple processes can run at a time.**
Thus, Redis/Postgres should generally be used for any cached/persistent data.

## Architecture

This is a standard express backend + react frontend application. Frontend files
live in `./client`, and backend files live at the root of the project.

The API routes are set up in [app.mjs](./app.mjs), and are listed in [routes/](./routes);
the frontend groups all API communication functions in [./client/src/api.js](./client/src/api.js).
The [models/](./models) folder contains the functions to retrieve the actual data,
depending on where it is. Some of it is in Postgres databases (genes, peaks, sessions); the tracks
come from the `tracks/mergedTracks` folders configured previously, the variants (aka samples) data
comes from `gemini`, and the UCSC track hubs are generated on the fly.

# EpiVar Browser - Production instance

TODO

## Importing Data

Setting up `EPIVAR_UID` environment variable before working:

```bash
export EPIVAR_UID=$UID
```

Genes and gene-peak pairs:

```bash
docker compose exec -iT epivar-node-1-server node ./scripts/import-genes.mjs < /opt/epivar/input-files/flu-infection-gene-peaks.csv
docker compose exec -iT epivar-node-2-server node ./scripts/import-genes.mjs < TODO
```
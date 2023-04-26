require('dotenv').config();

const config = require("../config");

(async () => {
  const db = await import("../models/db.mjs");

  // Clear relevant table of existing data
  await db.run("TRUNCATE TABLE binned_most_significant_peaks RESTART IDENTITY CASCADE");

  // Only calculate top binned peaks by assay for chromosomes whose size has been provided in config.js
  const chromSizes = config.plots?.manhattan?.chromosomeSizes ?? {};
  const minPValue = config.plots?.manhattan?.minPValue ?? 0.10;
  const binSize = config.plots?.manhattan?.binSize ?? 25000;

  for (const chrom in chromSizes) {
    const size = chromSizes[chrom];
    for (let i = 0; i < Math.ceil(size / binSize); i++) {
      const binLeft = i * binSize;
      const binRight = (i + 1) * binSize - 1;

      // Calculate top peaks for each assay for this bin
      const res = await db.findAll(
        `
        SELECT p."id" 
        FROM peaks p 
            JOIN features f on p."feature" = f."id"
            JOIN (
                SELECT f."assay" AS a_id, MIN(LEAST(p2."valueFlu", p2."valueNI")) AS p_min
                FROM peaks p2
                    JOIN snps s on p2."snp" = s."id"
                    JOIN features f on f."id" = p2."feature"
                WHERE s."chrom" = $1
                  AND s."position" >= $2
                  AND s."position" <= $3
                GROUP BY a_id
                HAVING MIN(LEAST(p2."valueFlu", p2."valueNI")) <= $4
            ) j ON f.assay = j.a_id AND LEAST(p."valueFlu", p."valueNI") = j.p_min
        LIMIT 1
        `,
        [chrom, binLeft, binRight, minPValue]
      );

      const peak = res.length ? res[0].id : null;
      await db.insert(
        `INSERT INTO binned_most_significant_peaks ("chrom", "pos_bin", "peak")
         VALUES ($1, $2, $3)`,
        [chrom, binLeft, peak]);
    }
  }
})();

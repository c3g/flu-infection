import sharp from "sharp";
import express from "express";

import {ensureAgreedToTerms, ensureLogIn} from "../helpers/auth.mjs";
import {dataHandler, errorHandler, pngHandler} from "../helpers/handlers.mjs";
import Tracks from "../models/tracks.mjs";
import Peaks from "../models/peaks.mjs";
import {PLOT_HEIGHT, PLOT_WIDTH} from "../helpers/boxplot.mjs";

const SCALE_FACTOR = 2;
const PNG_DPI = 300;

const router = express.Router();

router.use((_req, res, next) => {
  res.header('Accept-Ranges', 'bytes');
  return next();
});

const getUsePrecomputed = ({precomputed}) => precomputed === "1";

router.post(
  '/values',
  ensureLogIn,
  ensureAgreedToTerms,
  ({query, body: peak}, res) => {
    // We're re-purposing this endpoint as basically a way to pre-cache any desired calculations,
    // without actually returning any values (since those are too close to re-identifiable.)
    //  - David L, 2022-03-02

    Tracks.values(peak, getUsePrecomputed(query))
      .then(Tracks.group)
      .then(Tracks.calculate)
      .then(() => dataHandler(res)(undefined))  // Return an ok message without any data
      .catch(errorHandler(res));
  });

const svgToPng = data =>
  sharp(Buffer.from(data), {density: PNG_DPI})
    .resize(PLOT_WIDTH * SCALE_FACTOR, PLOT_HEIGHT * SCALE_FACTOR)
    .toBuffer();

router.get(
  '/plot/:peakID',
  ensureLogIn,
  ensureAgreedToTerms,
  ({params, query}, res) => {
    // We go through a lot of headache to generate plots on the server side
    // (despite it being a nice modern front end) not because we're naive but
    // because we're trying to make the site more secure against
    // re-identification via re-running bigWigSummary on downloaded BigWigs and
    // cross-referencing them with exact values - DL

    Peaks.selectByID(params.peakID || -1).then(peak => {
      if (!peak) {
        sharp().resize(1, 1).png().toBuffer()
          .then(pngHandler(res.status(400)))
          .catch(err => {
            console.error(err.stack);
            res.status(500).end();
          });
      }

      Tracks.values(peak, getUsePrecomputed(query))
        .then(Tracks.group)
        .then(Tracks.calculate)
        .then(Tracks.plot)
        .then(svgToPng)
        .then(pngHandler(res))
        .catch(err => {
          console.error(err.stack);

          // Display error in PNG form
          svgToPng(
            `<svg width="${PLOT_WIDTH}" height="${PLOT_HEIGHT}">
              <text x="20" y="30" fill="#C33" style="font-size: 16px; font-family: sans-serif; font-weight: bold;">
                Error while plotting:
              </text>
              <text x="20" y="50" fill="#933" style="font-size: 16px; font-family: sans-serif">
                An error occurred while generating this plot. Check the server logs for details.
              </text>
            </svg>`
          ).then(pngHandler(res.status(500)));
        });
    });
  });

export default router;

const fs = require("fs");
const file = require("path").resolve(__dirname, "gallery-admin.mjs");
let c = fs.readFileSync(file, "utf8");

// The onclick="pick(...)" breaks because JSON.stringify adds double-quotes
// inside an HTML attribute that also uses double-quotes.
// Fix: swap to data-path attribute + event delegation.

// Pattern inside the JSON-stringified HTML string in the .mjs file:
// onclick=\\"pick(' + JSON.stringify(p.relPath) + ')\\"
c = c.replace(
  'onclick=\\\\"pick(\' + JSON.stringify(p.relPath) + \')\\\\">\'',
  'data-path=\\\\"' + esc(p.relPath) + '\\\\" style=\\\\"cursor:pointer\\\\">\''
);

// Also search without the esc pattern - raw replacement
c = c.replace(
  /onclick=\\?"pick\(' \+ JSON\.stringify\(p\.relPath\) \+ '\)\\?">/g,
  'data-path=\\"' + esc(p.relPath) + '\\" style=\\"cursor:pointer\\">'
);

console.log("checking...");
if (c.includes("JSON.stringify(p.relPath)")) {
  console.log("STILL FOUND - trying direct string match");
}

// show the relevant section
const idx = c.indexOf("card");
console.log(c.slice(idx - 5, idx + 150));
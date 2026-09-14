const path = require("node:path");
const { pathToFileURL } = require("node:url");

module.exports = async function afterPack(context) {
  if (context.electronPlatformName !== "darwin") {
    return;
  }

  const productFilename = context.packager.appInfo.productFilename;
  const asarPath = path.join(
    context.appOutDir,
    `${productFilename}.app`,
    "Contents",
    "Resources",
    "app.asar",
  );
  const inspectModuleUrl = pathToFileURL(
    path.join(__dirname, "inspect-packaged-js.mjs"),
  ).href;
  const { assertJavaScriptGraph, inspectAsar } = await import(inspectModuleUrl);
  const problems = inspectAsar(asarPath, context.packager.projectDir);
  assertJavaScriptGraph(problems, asarPath);
};

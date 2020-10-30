const tar = require("tar-stream");
const zlib = require("zlib");

function untarFiles(tarStream, getWriteStream) {
  return new Promise((resolve, reject) => {
    const extract = tar.extract();

    extract.on("entry", function (header, stream, next) {
      const target = getWriteStream(header);
      if (target) {
        stream.pipe(target);
      }
      stream.on("end", next);
      stream.resume();
    });

    extract.on("finish", resolve);
    extract.on("error", reject);

    tarStream.pipe(zlib.createGunzip()).pipe(extract);
  });
}

function safe(fn) {
  return (...args) => {
    if (!args.some((a) => a == null)) {
      return fn(...args);
    }
  };
}

module.exports = {
  untarFiles,
  safe,
};

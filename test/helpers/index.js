const { ecsign } = require("ethereumjs-util");

const prepend0x = (v) => v.replace(/^(0x)?/, "0x");

const strip0x = (v) => v.replace(/^0x/, "");

const hexStringFromBuffer = (buf) => "0x" + buf.toString("hex");

const bufferFromHexString = (hex) => Buffer.from(strip0x(hex), "hex");

const ecSign = (digest, privateKey) => {
  const { v, r, s } = ecsign(
    bufferFromHexString(digest),
    bufferFromHexString(privateKey)
  );

  return { v, r: hexStringFromBuffer(r), s: hexStringFromBuffer(s) };
};

module.exports = {
  prepend0x,
  strip0x,
  hexStringFromBuffer,
  bufferFromHexString,
  ecSign,
};

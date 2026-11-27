// Phaser turns each downloaded picture into an <img>. The browser decodes an
// <img> on the main thread the first time it is sent to the GPU: 17-34 ms for
// each of a world's large paintings, 60-85 ms per world, felt as a hitch on
// the move that changes the world. createImageBitmap decodes on another
// thread, so only a 3-5 ms upload is left on the main thread.
//
// The bitmap is premultiplied, as Phaser draws (WebGL ignores its unpack
// settings for a bitmap), so edges look exactly as before. Where the browser
// has no createImageBitmap, or it fails on a file, the old way is used.
export function decodeImagesOffThread(Phaser) {
  if (typeof window.createImageBitmap !== "function") return;
  const ImageFile = Phaser.Loader.FileTypes.ImageFile.prototype;
  const decodeAsImage = ImageFile.onProcess;
  ImageFile.onProcess = function () {
    const blob = this.xhrLoader?.response;
    if (this.linkFile || !(blob instanceof Blob)) return decodeAsImage.call(this);
    this.state = Phaser.Loader.FILE_PROCESSING;
    createImageBitmap(blob, { premultiplyAlpha: "premultiply" }).then(
      bitmap => { this.data = bitmap; this.onProcessComplete(); },
      () => decodeAsImage.call(this)
    );
  };

  // A bitmap holds its decoded pixels until it is closed: free them when a
  // world's textures are removed, as an <img> would have let them go.
  const TextureSource = Phaser.Textures.TextureSource.prototype;
  const destroy = TextureSource.destroy;
  TextureSource.destroy = function () {
    const image = this.image;
    destroy.call(this);
    if (image instanceof ImageBitmap) image.close();
  };
}

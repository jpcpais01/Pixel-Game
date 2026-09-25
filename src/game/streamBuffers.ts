import Phaser from 'phaser';

/**
 * Phones stalled on every draw call, whatever the resolution.
 *
 * Each Phaser pipeline keeps one vertex buffer (room for `batchSize` quads)
 * and every flush overwrites the start of it with `bufferSubData` while the
 * GPU may still be drawing the previous batch from it. A desktop driver
 * shrugs that off; a phone's driver (tile-based GPUs, ANGLE on Vulkan)
 * either waits for the GPU to finish or copies the whole buffer first, once
 * per draw call. With a hundred-odd draws a frame that alone held phones to
 * 10-20 FPS, and drawing fewer pixels (Fast, Low) changed nothing.
 *
 * The fix is the standard streaming pattern: give the buffer fresh storage
 * (`bufferData` with a size, "orphaning") just before each upload, so the
 * driver never has to wait or copy; the old storage is freed once the GPU is
 * done with it. The buffers are also kept small (see `batchSize` in main.ts)
 * so the fresh storage is cheap.
 */
export function streamVertexBuffers(): void {
  type Pipeline = Phaser.Renderer.WebGL.WebGLPipeline & { vertexData: ArrayBuffer };
  const proto = Phaser.Renderer.WebGL.WebGLPipeline.prototype as Pipeline;
  const flush = proto.flush;
  proto.flush = function (this: Pipeline, isPostFlush?: boolean) {
    if (this.vertexCount > 0 && this.active) {
      const gl = this.gl;
      this.setVertexBuffer();
      gl.bufferData(gl.ARRAY_BUFFER, this.vertexData.byteLength, gl.DYNAMIC_DRAW);
    }
    return flush.call(this, isPostFlush);
  };
}

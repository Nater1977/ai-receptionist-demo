// recorder-processor.js
class RecorderProcessor extends AudioWorkletProcessor {
  constructor() {
    super();
    this._buffer = [];
  }

  process(inputs, outputs, parameters) {
    const input = inputs[0];
    if (input && input[0]) {
      // copy the Float32 samples
      const samples = new Float32Array(input[0].length);
      samples.set(input[0]);
      // send the raw float32 samples to main thread
      this.port.postMessage(samples);
    }
    // continue processing
    return true;
  }
}

registerProcessor("recorder-processor", RecorderProcessor);

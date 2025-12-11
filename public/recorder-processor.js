class RecorderProcessor extends AudioWorkletProcessor {
  process(inputs, outputs, parameters) {
    const input = inputs[0];
    if (input.length > 0) {
      const channelData = input[0]; // first channel
      this.port.postMessage(channelData);
    }
    return true;
  }
}

registerProcessor('recorder-processor', RecorderProcessor);

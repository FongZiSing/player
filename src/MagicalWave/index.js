class Cargo {
  constructor(audio, affirm = () => { }) {
    audio.onchange = this.onchange;
    this.affirm = affirm;
  }

  onchange = (e) => {
    const file = e.target.files[0];
    this.fileReader = new FileReader();
    this.fileReader.onload = this.onload;
    this.fileReader.readAsArrayBuffer(file);
  }

  onload = (e) => {
    this.affirm(e.target.result);
  }
}

class Cricle {
  constructor(context, pole, petal, radius, color, α = 0) {
    this.ctx = context;
    this.pole = pole;
    this.petal = petal;
    this.radius = radius;
    this.color = color;
    this.α = α;
    this.length = petal * 3;
    this.buffer = [];
    this.data = [];
    this.__init();
    this.render();
  }

  __init() {
    const θ = 2 * Math.PI / this.petal;
    const cosθ = Math.cos(θ);
    const sinθ = Math.sin(θ);
    const h = this.radius * (4 * (1 - Math.cos(θ / 2))) / (3 * Math.sin(θ / 2));
    const A = [this.radius, 0];
    const B = [this.radius, h];
    const C = [this.radius * cosθ + h * sinθ, this.radius * sinθ - h * cosθ];
    for (let i = 0, idx = 0; i < this.petal; ++i, idx += 3) {
      const cosNθ = Math.cos(i * θ + this.α);
      const sinNθ = Math.sin(i * θ + this.α);
      this.data[idx] = this.__rotate(A, cosNθ, sinNθ);
      this.data[idx + 1] = this.__rotate(B, cosNθ, sinNθ);
      this.data[idx + 2] = this.__rotate(C, cosNθ, sinNθ);
    }
    this.data.forEach((v, i) => { this.buffer[i] = [v[0] + this.pole[0], v[1] + this.pole[1]]; });
    this.buffer[this.buffer.length] = this.buffer[0];
  }

  __rotate(p, cosα, sinα) {
    return [p[0] * cosα - p[1] * sinα, p[1] * cosα + p[0] * sinα];
  }

  update(scale) {
    for (let i = this.data.length; i--;) {
      this.buffer[i][0] = this.data[i][0] * scale[i] + this.pole[0];
      this.buffer[i][1] = this.data[i][1] * scale[i] + this.pole[1];
    }
  }

  render() {
    this.ctx.moveTo(this.buffer[0][0], this.buffer[0][1]);
    this.ctx.beginPath();
    this.ctx.strokeStyle = 'blue';
    for (let i = 0, idx = 0; i < this.petal; ++i, idx += 3) {
      const A = this.buffer[idx];
      const B = this.buffer[idx + 1];
      const C = this.buffer[idx + 2];
      const D = this.buffer[idx + 3];
      this.ctx.lineTo(...A);
      this.ctx.bezierCurveTo(...B, ...C, ...D);
    }
    this.ctx.closePath();
    this.ctx.fillStyle = this.color;
    this.ctx.fill();
  }
}

class Scene {
  constructor(canvas, audioInput) {
    this.cvs = canvas;
    this.canvasCtx = canvas.getContext("2d");
    this.audioCtx = new (window.AudioContext || window.webkitAudioContext)();
    this.source = this.audioCtx.createBufferSource();
    this.analyser = this.audioCtx.createAnalyser();
    this.fragment = new Uint8Array(this.analyser.frequencyBinCount);
    this.cargo = new Cargo(audioInput, this.run);
    this.scale = [];
    this.sample = [];
    const pole = [canvas.width / 2, canvas.height / 2];
    const petal = 64;
    const radius = canvas.width / 2 * .5625;
    this.cricle = [
      new Cricle(this.canvasCtx, pole, petal, radius, 'rgba(241, 240, 237, .1)', 0),
      new Cricle(this.canvasCtx, pole, petal, radius, 'rgba(241, 240, 237, .1)', Math.PI * 2 / 3),
      new Cricle(this.canvasCtx, pole, petal, radius, 'rgba(241, 240, 237, .1)', Math.PI * 4 / 3)
    ];
  }

  __lerp(src, dst, coeff) {
    return src + (dst - src) * coeff;
  }

  __downsampling(n = 32) {
    const length = Math.floor(this.fragment.length / n);
    let i, j, idx = 0;
    for (i = 0; i < length; ++i) {
      this.sample[i] = 0;
      for (j = n; j--; ++idx) {
        this.sample[i] += this.fragment[idx];
      }
      this.sample[i] /= n;
    }
  }

  __smooth(data) {
    const buffer = [...data];
    const size = 9, part = 4;
    let i, j, k, aver = 0;
    for (i = 0, j = data.length; j < data.length << 1; ++i, ++j) {
      for (k = j - part, aver = 0; k <= j + part; ++k) {
        aver += buffer[k % data.length];
      }
      data[i] = aver / size;
    }
  }

  run = (data) => {
    this.audioCtx.decodeAudioData(data, (buffer) => {
      this.source.buffer = buffer;
      this.source.connect(this.audioCtx.destination);
      this.source.connect(this.analyser);
      this.handle = requestAnimationFrame(this.render);
      this.source.start(0);
    }, (err) => console.log(err));
  }

  stop = () => {
    this.source.stop();
    cancelAnimationFrame(this.handle);
  }

  draw(round) {
    const scale = [];
    this.__downsampling(10);
    for (let i = 0; i < round.length / 2; ++i) {
      scale[i] = scale[round.length - i - 1] = this.__lerp(1, 1.15, this.sample[i] / 255);
    }
    this.__smooth(scale);
    round.update(scale);
    round.render();
  }

  render = () => {
    this.canvasCtx.clearRect(0, 0, this.cvs.width, this.cvs.height);
    this.analyser.getByteFrequencyData(this.fragment);
    this.cricle.forEach(v => this.draw(v));
    this.handle = requestAnimationFrame(this.render);
  }
}

const canvas = document.getElementById('background');
const audioInput = document.getElementById('sound');
const goon = document.getElementById('goon');
canvas.width = canvas.height = Math.ceil(canvas.parentNode.lastElementChild.offsetWidth * 1.68421);
const scene = new Scene(canvas, audioInput);
goon.onclick = () => {
  scene.stop();
}


let sWebAudioContext = null;
let sWebAudioBiquad  = null;


class Controller {


constructor()
{
    this._views   = [ ];

    this._referenceGain   = 0;
    this._referenceRate   = 0;
    this._referenceValues = null;
    this._mode            = "compare";
}

loadState()
{
    let biquads         = null;
    let referenceValues = null;
    let referenceGain   = 0;
    let referenceRate   = 0;
    let mode            = null;

    function load(storage) {
        biquads = _.map(JSON.parse(storage.getItem("biquads")), b => {
            let biquad = new Biquad();

            biquad.type      = b[0];
            biquad.frequency = b[1];
            biquad.Q         = b[2];
            biquad.gain      = b[3];

            return biquad;
        });


        referenceValues = JSON.parse(storage.getItem("reference-values")) || null;
        referenceGain   = JSON.parse(storage.getItem("reference-gain"))   || 0;
        referenceRate   = JSON.parse(storage.getItem("reference-rate"))   || 0;
        mode            =            storage.getItem("mode")              || null;
    }

    try {
        load(window.localStorage);
    } catch (e) {
        try {
            load(window.sessionStorage);
        } catch (e) {
            console.log(e);
        }
    }

    this._views = _.map(biquads, biquad => {
        return new BiquadView(biquad, this);
    });

    this._referenceValues = referenceValues;
    this._referenceGain   = referenceGain;
    this._referenceRate   = referenceRate;
    this._mode            = mode || "compare";

    $("#mode").value     = this._mode;
    $("#ref-gain").value = this._referenceGain;
}

saveState()
{
    let biquads = _.map(this._views, view => {
        let biquad = view.biquad;
        return [ biquad.type, biquad.frequency, biquad.Q, biquad.gain ];
    });

    let referenceRate   = this._referenceRate;
    let referenceGain   = this._referenceGain;
    let referenceValues = this._referenceValues;
    let mode            = this._mode;

    function save(storage) {
        storage.setItem("biquads",          JSON.stringify(biquads));
        storage.setItem("reference-rate",   JSON.stringify(referenceRate));
        storage.setItem("reference-gain",   JSON.stringify(referenceGain));
        storage.setItem("reference-values", JSON.stringify(referenceValues));
        storage.setItem("mode",             mode);
    }

    try {
        save(window.localStorage);
    } catch (e) {
        save(window.sessionStorage);
    }
}

_getFilterFrequencies()
{
    return _.map(this._views, view => {
        return view.biquad.frequency;
    });
}

_getLogFrequencyArray(N, additional)
{
    let n      = additional ? additional.length : 0;
    let result = new Float32Array(N + n);

    let minFrequency = Math.log10(1);
    let maxFrequency = Math.log10(20000);

    for (let i = 0; i < N; i++) {
        result[i] = Math.pow(10, ((i / (N - 1)) * (maxFrequency - minFrequency)) + minFrequency);
    }

    for (let i = 0; i < n; i++) {
        result[N + i] = additional[i];
    }

    result.sort();

    return result;
}

_getWebAudioFrequencyResponse(frequencyArray)
{
    let magResponse   = new Float32Array(frequencyArray.length);
    let phaseResponse = new Float32Array(magResponse.length);
    let result        = new Float32Array(frequencyArray.length);

    if (!sWebAudioBiquad) {
        if (!sWebAudioContext) sWebAudioContext = new (window.AudioContext || window.webkitAudioContext)();
        sWebAudioBiquad = sWebAudioContext.createBiquadFilter();
    }

    _.each(this._views, view => {
        let biquad = view.biquad;

        sWebAudioBiquad.type = biquad.type;
        sWebAudioBiquad.Q.value = biquad.Q;
        sWebAudioBiquad.frequency.value = biquad.frequency;
        sWebAudioBiquad.gain.value = biquad.gain;

        sWebAudioBiquad.getFrequencyResponse(frequencyArray, magResponse, phaseResponse);

        for (let i = 0; i < frequencyArray.length; i++) {
            result[i] += 20 * Math.log10(magResponse[i]);
        }
    });

    return result;
}

_getLinFrequencyArray(N, rate)
{
    if (!rate) rate = 44100;
    let result = [ ];

    for (let i = 0; i < N; i++) {
        result[i] = ((i + 0.5) / N) * (rate / 2);
    }

    return result;
}

_getFilterFrequencyResponse(frequencyArray)
{
    let magResponse = new Float32Array(frequencyArray.length);
    let result      = new Float32Array(frequencyArray.length);

    _.each(this._views, view => {
        if (!view.mute) {
            view.biquad.getFrequencyResponse(frequencyArray, magResponse);

            for (let i = 0; i < frequencyArray.length; i++) {
                result[i] += magResponse[i];
            }
        }
    });

    return result;
}


_playNoise()
{
    let sampleRate  = 44100;
    let sampleCount = 2 * sampleRate;

    if (!sWebAudioContext) {
        sWebAudioContext = new (window.AudioContext || window.webkitAudioContext)();
    }

    let buffer      = sWebAudioContext.createBuffer(1, sampleCount, sampleRate);
    let channelData = buffer.getChannelData(0);

    console.time("Noise Generation");

    for (let i = 0; i < sampleCount; i++) {
        let R1 = Math.random();
        let R2 = Math.random();

        channelData[i] = Math.sqrt(-2.0 * Math.log(R1)) * Math.cos(2.0 * Math.PI * R2);
    }

    _.each(this._views, view => {
        view.biquad.process(channelData);
    });

    for (let i = 0; i < 100; i++) {
        channelData[i]               *= (i / 100);
        channelData[sampleCount - i] *= 1.0 - (i / 100);
    }

    console.timeEnd("Noise Generation");

    let source = sWebAudioContext.createBufferSource();
    source.buffer = buffer;
    source.connect(sWebAudioContext.destination);

    // Apply comb filter
    // let delay = sWebAudioContext.createDelay();
    // delay.delayTime.value = 1.0 / 256.0;
    // source.connect(delay)
    // delay.connect(sWebAudioContext.destination);

    source.start();
}


_importFrequencyResponseString(responseString)
{
    let data = [ ];
    let referenceRate = 0;

    _.each(responseString.split("\n"), line => {
        if (line[0] == "#") return;

        _.each(line.split(/[\t ,]/), component => {
            if (component.indexOf("=") > 0) {
                let pair = component.split("=");

                if (pair[0] == "rate") {
                    referenceRate = parseFloat(pair[1]);
                }

            } else {
                let c0 = parseFloat(component);
                if (!isNaN(c0)) data.push(c0);
            }
        });
    });

    this._referenceValues = data;
    this._referenceRate   = (referenceRate || 0);

    this._updateGraphAndSave();
}


_updateGraphAndSave()
{
    let logFrequencyArray = this._getLogFrequencyArray(512, this._getFilterFrequencies());
    let mode = this._mode;

    let chartData = [ ];

    function addData(frequencyArray, magnitudeArray, color) {
        chartData.push({
            color: color,
            shadowSize: 0,
            data: _.map(frequencyArray, (freq, i) => {
                return [ freq, magnitudeArray[i] ];
            })
        });
    }

    // In WebAudio mode, red line is the WebAudio FR and blue line is Filter FR
    //
    if (mode == "webaudio") {
        let webaudioData      = this._getWebAudioFrequencyResponse(logFrequencyArray);
        let filterData        = this._getFilterFrequencyResponse(logFrequencyArray);

        addData(logFrequencyArray, webaudioData, "rgba(200, 0, 0,   0.5)");
        addData(logFrequencyArray, filterData,   "rgba(0,   0, 200, 0.5)");

    } else if (mode == "apply") {
        if (this._referenceValues) {
            let linFrequencyArray = this._getLinFrequencyArray(this._referenceValues.length, this._referenceRate);
            let referenceGain     = this._referenceGain || 0;

            let filterData        = this._getFilterFrequencyResponse(linFrequencyArray);

            let referenceData = _.map(this._referenceValues, (value, i) => {
                return value + referenceGain + filterData[i];
            });

            addData(linFrequencyArray, referenceData, "rgba(200, 0, 0, 0.5)");
        }

    } else {
        if (this._referenceValues) {
            let linFrequencyArray = this._getLinFrequencyArray(this._referenceValues.length, this._referenceRate);
            let referenceGain     = this._referenceGain || 0;

            let referenceData = _.map(this._referenceValues, value => {
                return value + referenceGain;
            });

            addData(linFrequencyArray, referenceData, "rgba(200, 0, 0, 0.5)");
        }

        let filterData = this._getFilterFrequencyResponse(logFrequencyArray);

        addData(logFrequencyArray, filterData, "rgba(0, 0, 200, 0.5)");
    }

    _.each(this._views, view => {
        if (view.solo) {
            let magResponse = new Float32Array(logFrequencyArray.length);
            view.biquad.getFrequencyResponse(logFrequencyArray, magResponse);
            addData(logFrequencyArray, magResponse, "rgba(0, 128, 0, 0.5)");
        }
    });

    Flotr.draw($("#floatr-container"), chartData, {
        xaxis: {
            minorTickFreq: 4,
            ticks: [ 20, 40, 60, 80, 100, 200, 400, 600, 800, [ 1000, "1k" ], [ 2000, "2k" ], [ 4000, "4k" ], [ 6000, "6k" ], [8000, "8k"] , [ 10000, "10k"], [ 20000, "20k"] ],
            minorTicks: [ 30, 50, 70, 90, 100, 200, 300, 400, 500, 600, 700, 800, 900, 1000, 2000, 3000, 4000, 5000, 6000, 7000, 8000, 9000, 10000, 20000 ],
            min: 10,
            max: 20000,
            scaling: "logarithmic"
        },
        yaxis: {
            max: 6,
            min: -30,
            ticks: [ 6, 3, 0, -3, -6, -9, -12, -15, -18, -21, -24, -27, -30 ]
        },
        resolution: Math.ceil(window.devicePixelRatio || 1),
        grid: { minorVerticalLines: true }
    });

    this.saveState();
}

awake()
{
    $.listen($("#ref-import"), "click", () => {
        var responseString = prompt("Enter frequency response data", "");
        this._importFrequencyResponseString(responseString);
    });

    $.listen($("#mode"), "change", () => {
        let mode = $("#mode").value;

        if (!mode) {
            mode = this._mode;
            $("#mode").value = mode;
        }

        this._mode = mode;
        this._updateGraphAndSave();
    });

    $.listen($("#ref-clear"), "click", () => {
        this._referenceValues = null;
        this._referenceRate = 0;
        this._referenceGain = 0;
        this._updateGraphAndSave();
    });

    $.listen($("#ref-gain"), "change", () => {
        this._referenceGain = parseFloat($("#ref-gain").value) || 0;
        this._updateGraphAndSave();
    });

    $.listen($("#add"), "click", () => {
        let biquad = new Biquad();
        let view   = new BiquadView(biquad, this);

        this._views.push(view);

        $("#filters").append(view.element);

        this._updateGraphAndSave();
    });

    $.listen($("#play"), "click", () => {
        this._playNoise();
    });

    _.each(this._views, view => {
        $("#filters").appendChild(view.element)
    });

    if (window.location.hash.match("#demo") && !this._referenceValues) {
        $.fetch("./examples/demo.txt", (err, data) => {
            $("#mode").value = this._mode = "apply";
            this._importFrequencyResponseString(data);
        });

    }
    this._updateGraphAndSave();
}

biquadViewDidUpdate(biquadView)
{
    if (biquadView.solo) {
        _.each(this._views, view => {
            if (view.solo && view != biquadView) {
                view.solo = false;
            }
        })
    }

    this._updateGraphAndSave();
}

biquadViewDidRemove(view)
{
    $("#filters").removeChild(view.element);

    this._views   = _.without(this._views, view);
    this._updateGraphAndSave();
}

}


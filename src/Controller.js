
let sWebAudioContext = null;
let sWebAudioBiquad  = null;


class Controller {


constructor()
{
    this._views   = [ ];

    this._referenceGain   = 0;
    this._referenceValues = null;
    this._mode            = "compare";
}

loadState()
{
    let biquads         = null;
    let referenceValues = null;
    let referenceGain   = 0;
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

    let referenceGain   = this._referenceGain;
    let referenceValues = this._referenceValues;
    let mode            = this._mode;

    function save(storage) {
        storage.setItem("biquads",          JSON.stringify(biquads));
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

_getLinFrequencyArray(N)
{
    let result = [ ];

    for (let i = 0; i < N; i++) {
        result[i] = ((i + 0.5) / N) * (44100 / 2);
    }

    return result;
}

_getFilterFrequencyResponse(frequencyArray)
{
    let magResponse = new Float32Array(frequencyArray.length);
    let result      = new Float32Array(frequencyArray.length);

    _.each(this._views, view => {
        view.biquad.getFrequencyResponse(frequencyArray, magResponse);

        for (let i = 0; i < frequencyArray.length; i++) {
            result[i] += magResponse[i];
        }
    });

    return result;
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
            let linFrequencyArray = this._getLinFrequencyArray(this._referenceValues.length);
            let referenceGain     = this._referenceGain || 0;

            let filterData        = this._getFilterFrequencyResponse(linFrequencyArray);

            let referenceData = _.map(this._referenceValues, (value, i) => {
                return value + referenceGain + filterData[i];
            });

            addData(linFrequencyArray, referenceData, "rgba(200, 0, 0, 0.5)");
        }

    } else {
        if (this._referenceValues) {
            let linFrequencyArray = this._getLinFrequencyArray(this._referenceValues.length);
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
        if (view == this._selectedView) {
            let magResponse = new Float32Array(logFrequencyArray.length);
            view.biquad.getFrequencyResponse(logFrequencyArray, magResponse);
            addData(logFrequencyArray, magResponse, "rgba(0, 128, 0, 0.5)");

            view.setSelected(true);

        } else {
            view.setSelected(false);
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
        yaxis: { max: 6, min: -60 },
        resolution: Math.ceil(window.devicePixelRatio || 1),
        grid: { minorVerticalLines: true }
    });

    this.saveState();
}

awake()
{
    $.listen($("#ref-import"), "click", () => {
        var responseString = prompt("Enter frequency response data", "");

        let data = [ ];

        _.each(responseString.split("\n"), line => {
            _.each(line.split(/[\t ,]/), component => {
                let c0 = parseFloat(component);
                if (c0) data.push(c0);
            });
        });

        this._referenceValues = data;
        this._updateGraphAndSave();
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

    _.each(this._views, view => {
        $("#filters").appendChild(view.element)
    });

    this._updateGraphAndSave();
}

biquadViewDidSelect(biquadView)
{
    if (this._selectedView == biquadView) {
        this._selectedView = null;
    } else {
        this._selectedView = biquadView;
    }

    this._updateGraphAndSave();
}

biquadViewDidUpdate(biquadView)
{
    this._updateGraphAndSave();
}

biquadViewDidRemove(view)
{
    $("#filters").removeChild(view.element);

    this._views   = _.without(this._views, view);
    this._updateGraphAndSave();
}

}


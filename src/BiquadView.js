

class BiquadView {


constructor(biquad, delegate)
{
    this.biquad = biquad;
    this.delegate = delegate;

    let freqLabel = $.create("span",  { "class": "BiquadView-label" }, "Freq");
    let gainLabel = $.create("span",  { "class": "BiquadView-label" }, "Gain");
    let qLabel    = $.create("span",  { "class": "BiquadView-label" }, "Q");

    let freqRange = $.create("input", { "class": "BiquadView-range", "type": "range", "min": "1",   "max": "20000" });
    let gainRange = $.create("input", { "class": "BiquadView-range", "type": "range", "min": "-40", "max": "40", "step": "0.1" });
    let qRange    = $.create("input", { "class": "BiquadView-range", "type": "range", "min": "0.1", "max": "16", "step": "0.1" });

    let freqText  = $.create("input", { "class": "BiquadView-text",  "type": "text"  });
    let gainText  = $.create("input", { "class": "BiquadView-text",  "type": "text"  });
    let qText     = $.create("input", { "class": "BiquadView-text",  "type": "text"  });

    let removeButton = $.create("button", { "class": "BiquadView-remove"    }, "Remove");
    
    let muteSwitch   = $.create("div",    { "class": "BiquadView-mute-switch" }, "M");
    let soloSwitch   = $.create("div",    { "class": "BiquadView-solo-switch" }, "S");

    let typeSelect = $.create("select", { "class": "BiquadView-select" }, [
        $.create("option", { "value": "peaking"   }, "peaking"),
        $.create("option", { "value": "lowpass"   }, "lowpass" ),
        $.create("option", { "value": "highpass"  }, "highpass"),
        $.create("option", { "value": "bandpass"  }, "bandpass"),
        $.create("option", { "value": "lowshelf"  }, "lowshelf"),
        $.create("option", { "value": "highshelf" }, "highshelf"),
        $.create("option", { "value": "notch"     }, "notch")
    ]);

    function validateNumber(input) {
        let result = parseFloat(input);
        return isNaN(result) ? Binding.Invalid : result;
    }

    let update = () => {
        if (this.delegate && this.delegate.biquadViewDidUpdate) {
            this.delegate.biquadViewDidUpdate(this);
        }
    };

    this._bindings = [
        new Binding(this.biquad, "type",      [ typeSelect          ], null,           update.bind(this)),
        new Binding(this.biquad, "frequency", [ freqRange, freqText ], validateNumber, update.bind(this)),
        new Binding(this.biquad, "Q",         [ qRange,    qText    ], validateNumber, update.bind(this)),
        new Binding(this.biquad, "gain",      [ gainRange, gainText ], validateNumber, update.bind(this))
    ];

    this.element = $.create("div", { "class": "BiquadView" }, [
        $.create("div", { "class": "BiquadView-row" }, [
            typeSelect,
            removeButton,
            $.create("div", { "class": "BiquadView-padding" }),
            muteSwitch,
            soloSwitch
        ]),
        $.create("div", { "class": "BiquadView-row" }, [
            freqLabel, freqRange, freqText
        ]),
        $.create("div", { "class": "BiquadView-row" }, [
            gainLabel, gainRange, gainText
        ]),
        $.create("div", { "class": "BiquadView-row" }, [
            qLabel, qRange, qText
        ])
    ]);

    this.muteSwitch = muteSwitch;
    this.soloSwitch = soloSwitch;
    this._mute = false;
    this._solo = false;

    $.listen(muteSwitch, "click", () => {
        this.mute = !this.mute;
        update();
    });

    $.listen(soloSwitch, "click", () => {
        this.solo = !this.solo;
        update();
    });

    $.listen(removeButton, "click", () => {
        this.remove();
    });
}


remove()
{

    if (this.delegate && this.delegate.biquadViewDidRemove) {
        this.delegate.biquadViewDidRemove(this);
    }
}

set solo(yn)
{
    this._solo = yn;
    this.soloSwitch.classList.toggle("active", yn);
}

set mute(yn)
{
    this._mute = yn;
    this.muteSwitch.classList.toggle("active", yn);
}

get solo()
{
    return this._solo;
}

get mute()
{
    return this._mute;
}


}

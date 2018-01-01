

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
    let selection    = $.create("div",    { "class": "BiquadView-selection" });

    let typeSelect = $.create("select", { "class": "BiquadView-select" }, [
        $.create("option", { "value": "lowpass"   }, "lowpass" ),
        $.create("option", { "value": "highpass"  }, "highpass"),
        $.create("option", { "value": "bandpass"  }, "bandpass"),
        $.create("option", { "value": "lowshelf"  }, "lowshelf"),
        $.create("option", { "value": "highshelf" }, "highshelf"),
        $.create("option", { "value": "peaking"   }, "peaking"),
        $.create("option", { "value": "notch"     }, "notch")
    ]);

    function validateNumber(input) {
        let result = parseFloat(input);
        return isNaN(result) ? Binding.Invalid : result;
    }

    function update() {
        if (this.delegate && this.delegate.biquadViewDidUpdate) {
            this.delegate.biquadViewDidUpdate(this);
        }
    }

    this._bindings = [
        new Binding(this.biquad, "type",      [ typeSelect          ], null,           update.bind(this)),
        new Binding(this.biquad, "frequency", [ freqRange, freqText ], validateNumber, update.bind(this)),
        new Binding(this.biquad, "Q",         [ qRange,    qText    ], validateNumber, update.bind(this)),
        new Binding(this.biquad, "gain",      [ gainRange, gainText ], validateNumber, update.bind(this))
    ];

    this.element = $.create("div", { "class": "BiquadView" }, [
        $.create("div", { "class": "BiquadView-row" }, [
            typeSelect, removeButton, $.create("div", { "class": "BiquadView-padding" }), selection
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

    this.selection = selection

    $.listen(selection, "click", () => {
        this.delegate.biquadViewDidSelect(this);
    });

    $.listen(removeButton, "click", () => {
        this.remove();
    });
}


setSelected(yn)
{
    this.selection.classList.toggle("selected", yn);
}


remove()
{

    if (this.delegate && this.delegate.biquadViewDidRemove) {
        this.delegate.biquadViewDidRemove(this);
    }
}


}

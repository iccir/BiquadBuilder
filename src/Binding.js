
class Binding {

constructor(object, key, elements, validator, callback)
{
    if (elements && !Array.isArray(elements)) {
        elements = [ elements ];
    }

    this._object    = object;
    this._key       = key;
    this._elements  = elements;
    this._validator = validator;
    this._callback  = callback;
    this._value     = object[key];

    _.each(this._elements, element => {
        function handleChange() {
            let v = element.value
            if (validator) v = validator(v);

            if (v !== Binding.Invalid) {
                this.value = v;
            }
        }
        
        element.value = object[key];

        $.listen(element, "input",  handleChange.bind(this));
        $.listen(element, "change", handleChange.bind(this));
    });
}


set value(v)
{
    if (this._value != v) {
        let previous = this._value;

        this._value = v;
        this._object[this._key] = v;

        _.each(this._elements, element => {
            element.value = v;
        });

        if (this._callback) {
            this._callback(previous, v)
        }
    }
}


get value()
{
    return this._value;
}


}

Binding.Invalid = { };
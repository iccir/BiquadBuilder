
class Biquad {


constructor()
{   
    this.type      = "peaking";
    this.frequency = 5000;
    this.Q         = 0.7071;
    this.gain      = 0;
}


_computeCoefficients()
{
    let type      = this.type;
    let frequency = this.frequency;
    let gain      = this.gain;
    let Q         = this.Q;

    let b0 = 0;
    let b1 = 0;
    let b2 = 0;
    let a0 = 0;
    let a1 = 0;
    let a2 = 0;

    let A;
    if (type == "peaking" || type == "lowshelf" || type == "highshelf") {
        A = Math.pow(10, gain / 40.0);
    } else {
        A = Math.sqrt(Math.pow(10, gain / 20.0));
    }

    let w0    = 2 * Math.PI * frequency / 44100;
    let sin   = Math.sin(w0);
    let cos   = Math.cos(w0);
    let alpha = sin / (2 * Q);

    if (type == "lowpass") {
        b0 =  (1 - cos)/2;
        b1 =   1 - cos;
        b2 =  (1 - cos)/2;
        a0 =   1 + alpha;
        a1 =  -2*cos;
        a2 =   1 - alpha;

    } else if (type == "highpass") {
        b0 =  (1 + cos)/2;
        b1 = -(1 + cos);
        b2 =  (1 + cos)/2;
        a0 =   1 + alpha;
        a1 =  -2*cos;
        a2 =   1 - alpha;

    } else if (type == "bandpass") {
        b0 =   alpha;
        b1 =   0;
        b2 =  -alpha;
        a0 =   1 + alpha;
        a1 =  -2*cos;
        a2 =   1 - alpha;

    } else if (type == "lowshelf" || type == "highshelf") {
        let Aplus1      = A + 1;
        let Aminus1     = A - 1;
        let Aplus1_cos  = Aplus1  * cos;
        let Aminus1_cos = Aminus1 * cos;
        let beta_sin    = Math.sqrt(A) * Math.SQRT2 * sin;

        if (type == "lowshelf") {
            b0 =    A*( Aplus1  - Aminus1_cos + beta_sin );
            b1 =  2*A*( Aminus1 - Aplus1_cos             );
            b2 =    A*( Aplus1  - Aminus1_cos - beta_sin );
            a0 =      ( Aplus1  + Aminus1_cos + beta_sin );
            a1 =   -2*( Aminus1 + Aplus1_cos            );
            a2 =      ( Aplus1  + Aminus1_cos - beta_sin );
        } else {
            b0 =    A*( Aplus1  + Aminus1_cos + beta_sin );
            b1 = -2*A*( Aminus1 + Aplus1_cos             );
            b2 =    A*( Aplus1  + Aminus1_cos - beta_sin );
            a0 =      ( Aplus1  - Aminus1_cos + beta_sin );
            a1 =    2*( Aminus1 - Aplus1_cos             );
            a2 =      ( Aplus1  - Aminus1_cos - beta_sin );
        }

    } else if (type == "notch") {
        b0 =   1;
        b1 =  -2*cos;
        b2 =   1;
        a0 =   1 + alpha;
        a1 =  -2*cos;
        a2 =   1 - alpha;

    } else if (type == "peaking") {
        b0 =   1 + alpha*A;
        b1 =  -2*cos;
        b2 =   1 - alpha*A;
        a0 =   1 + alpha/A;
        a1 =  -2*cos;
        a2 =   1 - alpha/A;
    }

    this._coefficients = [
        b0 / a0,
        b1 / a0,
        b2 / a0,
        a1 / a0,
        a2 / a0
    ];
}


process(buffer)
{
    let x1 = 0;
    let x2 = 0;
    let y1 = 0;
    let y2 = 0;

    let coefficients = this._coefficients;

    let b0 = coefficients[0];
    let b1 = coefficients[1];
    let b2 = coefficients[2];
    let a1 = coefficients[3];
    let a2 = coefficients[4];
    
    for (let i = 0; i < buffer.length; i++) {
        let x = buffer[i];
        let y = b0*x + b1*x1 + b2*x2 - a1*y1 - a2*y2;

        x2 = x1; x1 = x;
        y2 = y1; y1 = y;

        buffer[i] = y;
    }
}


getFrequencyResponse(frequencyArray, magResponse)
{
    if (!this._coefficients) {
        this._computeCoefficients();
    }

    let coefficients = this._coefficients;

    let b0 = coefficients[0];
    let b1 = coefficients[1];
    let b2 = coefficients[2];
    let a1 = coefficients[3];
    let a2 = coefficients[4];
    

    for (let i = 0; i < frequencyArray.length; i++) {
        let w = 2 * (frequencyArray[i] / 44100) * Math.PI;

        var phi = Math.pow(Math.sin(w/2), 2);

        var y   = Math.log(Math.pow(b0+b1+b2, 2) - 4*(b0*b1 + 4*b0*b2 + b1*b2)*phi + 16*b0*b2*phi*phi) -
                  Math.log(Math.pow(1 +a1+a2, 2) - 4*(a1    + 4*a2    + a1*a2)*phi + 16*a2   *phi*phi);

        y = y * 10 / Math.LN10;

        magResponse[i] = y;
    }
}


set type(t)      { this._type      = t;  this._coefficients = null; }
set frequency(f) { this._frequency = f;  this._coefficients = null; }
set Q(q)         { this._Q         = q;  this._coefficients = null; }
set gain(g)      { this._gain      = g;  this._coefficients = null; }

get type()       { return this._type;      }
get frequency()  { return this._frequency; }
get Q()          { return this._Q;         }
get gain()       { return this._gain;      }


}

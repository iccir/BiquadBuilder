#!/usr/bin/python

import math
import sys
import os
import numpy as np
import scipy.signal
import scipy.fftpack
import scikits.audiolab as audiolab


# From sms-tools (https://github.com/MTG/sms-tools)
# License: GNU AGPL v3
#
def dftAnal(x, w, N):
    """
    Analysis of a signal using the discrete Fourier transform
    x: input signal, w: analysis window, N: FFT size 
    """
    hN = (N/2)+1                                            # size of positive spectrum, it includes sample 0
    hM1 = int(math.floor((w.size+1)/2))                     # half analysis window size by rounding
    hM2 = int(math.floor(w.size/2))                         # half analysis window size by floor
    fftbuffer = np.zeros(N)                                 # initialize buffer for FFT
    w = w / sum(w)                                          # normalize analysis window
    xw = x*w                                                # window the input sound
    fftbuffer[:hM1] = xw[hM2:]                              # zero-phase window in fftbuffer
    fftbuffer[-hM2:] = xw[:hM2]        
    X = scipy.fftpack.fft(fftbuffer)                        # compute FFT
    absX = abs(X[:hN])                                      # compute ansolute value of positive side
    absX[absX<np.finfo(float).eps] = np.finfo(float).eps    # if zeros add epsilon to handle log
    mX = 20 * np.log10(absX)                                # magnitude spectrum of positive frequencies in dB
    return mX


# From sms-tools (https://github.com/MTG/sms-tools)
# License: GNU AGPL v3
#
def stftAnal(x, w, N, H) :
    """
    Analysis of a sound using the short-time Fourier transform
    x: input array sound, w: analysis window, N: FFT size, H: hop size
    """
    M = w.size                                      # size of analysis window
    hM1 = int(math.floor((M+1)/2))                  # half analysis window size by rounding
    hM2 = int(math.floor(M/2))                      # half analysis window size by floor
    x = np.append(np.zeros(hM2),x)                  # add zeros at beginning to center first window at sample 0
    x = np.append(x,np.zeros(hM2))                  # add zeros at the end to analyze last sample
    pin = hM1                                       # initialize sound pointer in middle of analysis window       
    pend = x.size-hM1                               # last sample to start a frame
    w = w / sum(w)                                  # normalize analysis window
    while pin<=pend:                                # while sound pointer is smaller than last sample      
        x1 = x[pin-hM1:pin+hM2]                       # select one frame of input sound
        mX  = dftAnal(x1, w, N)                       # compute dft
        if pin == hM1:                                # if first frame create output arrays
            xmX = np.array([mX])
        else:                                         # append output to existing array 
            xmX = np.vstack((xmX,np.array([mX])))
        pin += H                                      # advance sound pointer
    return xmX


def smooth(x, s):
    ii = float(len(x))

    max = len(x) - 1

    out = np.zeros(len(x))

    for i in range(0, len(x)):
        w =  (i / ii) * s

        start = i - w//2
        end   = (i + w//2) + 1

        if start < 0: start = 0
        if end   > len(x): end = len(x)

        out[i] = np.average(x[start:end])

    return out

def read_file(path):
    sndfile = audiolab.Sndfile(path)
    frames = sndfile.read_frames(sndfile.nframes, dtype=np.float64)

    if len(frames.shape) > 1:
        frames = (frames[:,0] + frames[:,1]) / 2

    return frames, sndfile.samplerate


path = sys.argv[1]

if (os.path.isdir(path)):
    files = [f for f in os.listdir(path) if os.path.isfile(os.path.join(path, f)) ]
else:
    files = [ path ]

mXs = [ ]

for file in files:
    try:
        frames, rate = read_file(os.path.join(path, file))
    except:
        continue
       
    N = 4096

    mX = stftAnal(frames, scipy.signal.blackmanharris(N), N, int(N * 0.66))
    mXs.append( np.average(mX, axis=0) )

mX = np.average(mXs, axis=0)
mX = smooth(mX, 128)
mX += -np.max(mX)
mX = np.round(mX, decimals=2)

print ",".join([ "%s" % y for y in mX])        

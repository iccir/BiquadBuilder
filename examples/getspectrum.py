#!/usr/bin/python

import math
import sys
import os
import numpy as np
import scipy.signal
import scipy.fftpack
import scikits.audiolab as audiolab
import argparse


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

def read_file(path):
    sndfile = audiolab.Sndfile(path)
    frames = sndfile.read_frames(sndfile.nframes, dtype=np.float64)

    if len(frames.shape) > 1:
        frames = (frames[:,0] + frames[:,1]) / 2

    return frames, sndfile.samplerate

def plot(mX, rate):
    import matplotlib.pyplot as plt

    plt.grid(True)
    plt.xscale("log")

    plt.xticks( np.concatenate((
        np.arange(10,   100,   step=10),
        np.arange(100,  1000,  step=100),
        np.arange(1000, 10000, step=1000), 
        [ 10000 ],
        [ 20000 ]
    )) )

    n = len(mX)
    k = np.arange(n)
    T = n/(rate/2.0)
    frq = k / T

    plt.plot(frq, mX)
    plt.show()
  

parser = argparse.ArgumentParser(description="Perform a STFT of the input and output average magnitude")
parser.add_argument("file", nargs="+", help="the input files or directories")
parser.add_argument('--size',    dest="size",    default=4096, help="The FFT size, defaults to 4096")
parser.add_argument('--overlap', dest="overlap", default=8,    help="The time overlap, defaults to 8 (for 8x)")
parser.add_argument('--plot',    dest="plot", action="store_const", const=True, help="Show plot")

args = parser.parse_args()

mXs = [ ]
rate = 0

for path in args.file:
    if (os.path.isdir(path)):
        files = [f for f in os.listdir(path) if os.path.isfile(os.path.join(path, f)) ]
    else:
        files = [ path ]

    for file in files:
        try:
            file_frames, file_rate = read_file(os.path.join(path, file))
        except:
            continue
        
        if rate != 0 and file_rate != rate:
            sys.exit("Files are of different sampling rates.")
        else:
            rate = file_rate

        mX = stftAnal(file_frames, scipy.signal.blackmanharris(args.size), args.size, int(args.size * (1.0 / float(args.overlap))))
        mXs.append( np.average(mX, axis=0) )

mX = np.average(mXs, axis=0)
mX += -np.max(mX)
mX = np.round(mX, decimals=2)

if (args.plot):
    plot(mX, rate)
else:
    print "rate=%d,%s" % ( rate, ",".join([ "%s" % y for y in mX]))

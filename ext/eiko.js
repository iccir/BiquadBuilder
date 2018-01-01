// (c) 2016-2017 musictheory.net, LLC.
// MIT License, https://opensource.org/licenses/MIT

(function(root) { "use strict";

var _eiko_uid = 1;
var _animation_id = 1;
var _unusedEventListenerUIDs = [ ];
var _animations = { };
var _eventListenerMap = { };
var _eventHandler;
var _transformName;
var _transformOriginName;


function _isNode(obj)
{
    return obj instanceof Node;
}


function _isWindow(obj)
{
    return obj instanceof Window;
}


function _getEventListenerUID(element)
{
    if (element._eiko_uid) return element._eiko_uid;

    var uid = _unusedEventListenerUIDs.pop();
    if (!uid) uid = "" + (_eiko_uid++);
    element._eiko_uid = uid;

    return uid;
}


function _getCSSPropertyName(name)
{
    var capitalized = name[0].toUpperCase() + name.substr(1);

    var div   = document.createElement("div");
    var style = div.style;

    var nameToTry = name;
    if (style[nameToTry] !== undefined) return nameToTry;

    nameToTry = "webkit" + capitalized;
    if (style[nameToTry] !== undefined) return nameToTry;

    nameToTry = "Moz" + capitalized;
    if (style[nameToTry] !== undefined) return nameToTry;

    nameToTry = "ms" + capitalized;
    if (style[nameToTry] !== undefined) return nameToTry;

    return name;
}


function $(selectors, context)
{
    if (_.isString(selectors)) {
        return (context || document).querySelector(selectors);
    } else {
        return null;
    }
}


function query(selectors, context)
{
    return $(selectors, context);
}
$.query = query;


function queryAll(selectors, context)
{
    var result = [ ];

    if (_.isString(selectors)) {
        var nodeList = (context || document).querySelectorAll(selectors);

        for (var i = 0, length = nodeList.length; i < length; i++) {
            result.push(nodeList[i]);
        }

    } else if (_isNode(selectors) || _isWindow(selectors)) {
        result.push(selectors);
    }

    return result;
}
$.queryAll = queryAll;


function create(tagName, options, children, usesHTMLStrings)
{
    var result = document.createElement(tagName);

    if (_.isArray(options)) {
        children = options;
        options  = null;
    }

    if (options)  setAttributes(result, options);
    if (children) append(result, children, usesHTMLStrings);

    return result;
}
$.create = create;


function _appendOrPrepend(parent, children, isAppend, usesHTMLStrings)
{
    if (!parent) return;

    if (_.isString(children)) {
        if (usesHTMLStrings) {
            var tmp = document.createElement("div");
            tmp.innerHTML = children;

            _appendOrPrepend(parent, tmp.childNodes, isAppend);

        } else {
            _appendOrPrepend(parent, (parent.ownerDocument || document).createTextNode(children), isAppend);
        }

    } else if (_isNode(children)) {
        if (isAppend) {
            parent.appendChild(children);
        } else {
            parent.insertBefore(children, parent.firstChild);
        }

    } else if (children.length) {
        _.each(_.toArray(children), function(child) {
            _appendOrPrepend(parent, child, isAppend, usesHTMLStrings)
        });
    }
}


function append(parent, children, usesHTMLStrings)
{
    _appendOrPrepend(parent, children, true, usesHTMLStrings);
}
$.append = append;


function prepend(parent, children, usesHTMLStrings) 
{
    _appendOrPrepend(parent, children, false, usesHTMLStrings);
}
$.prepend = prepend;


function empty(parent)
{
    if (!parent) return;

    while (parent.lastChild) {
        parent.removeChild(parent.lastChild);
    }
}
$.empty = empty;


$.fetch = function fetch(url, options, callback)
{
    if (_.isFunction(options)) {
        callback = options;
        options  = { };
    }

    if (!url || !options || !callback) return;

    var method  = options.method ? options.method.toUpperCase() : "GET";
    var headers = options.headers || { };
    var isGET   = method == "GET";

    var request = new XMLHttpRequest();

    request.open(method, url, options.async !== false);
    if (options.type) request.responseType = options.type;

    _.each(options, function(value, key) {
        try {
            request[key] = value;
        } catch (e) {
            console.error(e);
        }
    });

    if (!isGET && !headers["Content-type"] && !headers["Content-Type"]) {
        request.setRequestHeader("Content-type", "application/x-www-form-urlencoded");
    }

    _.each(headers, function(value, key) {
        request.setRequestHeader(key, value);
    });

    request.onload = function() {
        var status = request.status;

        if (status == 0 || status == 304 || (status >= 200 && status < 300)) {
            callback(null, request.response || request.responseText);
        } else {
            callback(new Error(request.statusText), null);
        }
    };

    request.onerror = function() {
        callback(new Error("onerror"), null);
    };

    request.send(isGET ? null : options.data);
}


function remove(arg)
{
    if (_.isArray(arg)) {
        _.each(arg, function(node) {
            if (node && node.remove) node.remove();
        });
    } else {
        if (arg && arg.remove) arg.remove();
    }
}
$.remove = remove;


function setAttributes(node, attributes)
{
    if (!node) return;

    _.each(attributes, function(value, key) {
        node.setAttribute(key, value);
    });
}
$.setAttributes = setAttributes;


function listen(target, type, listener, useCapture)
{
    if (!target || !type || !listener) return;

    var wrappedListener = _.isFunction(listener) ? function(event) {
        var error = null;

        try {
            listener(event);
        } catch (e) {
            error = e;
        }

        if (_eventHandler) _eventHandler(error);
        else if (error) throw error;
    } : listener;

    var eventListenerUID;
    var eventListeners = _eventListenerMap[(eventListenerUID = _getEventListenerUID(target))];

    var o = {
        T: type,
        W: wrappedListener, // Wrapped listener to pass to removeEventListener
        L: listener,        // Original listener for comparison in unlisten
        C: !!useCapture
    };

    target.addEventListener(o.T, o.W, o.C);

    if (eventListeners) {
        eventListeners.push(o);

    } else {
        eventListeners = [ o ];
        _eventListenerMap[eventListenerUID] = eventListeners;
    }
}
$.listen = listen;


function unlisten(target, type, listener, useCapture)
{
    if (!target) return;

    var eventListenerUID;
    var oldEventListeners = _eventListenerMap[(eventListenerUID = _getEventListenerUID(target))];
    var newEventListeners = null;

    useCapture = !!useCapture;

    _.each(oldEventListeners, function(o) {
        if ((!type     || (type       == o.T)) &&
            (!listener || (listener   == o.L)) &&
                          (useCapture == o.C)
        ) {
            target.removeEventListener(o.T, o.W, o.C);

        } else {
            if (!newEventListeners) newEventListeners = [ ];
            newEventListeners.push(o);
        }
    });

    _eventListenerMap[eventListenerUID] = newEventListeners;

    if (!newEventListeners) {
        target._eiko_uid = 0;
        _unusedEventListenerUIDs.push(eventListenerUID);
    }
}
$.unlisten = unlisten;


function delay(durationInMs, doneCallback)
{
    animate(durationInMs, null, doneCallback);
}
$.delay = delay;


function animate(durationInMs, delayInMs, progressCallback, doneCallback)
{
    if (!_.isNumber(delayInMs)) {
        doneCallback     = progressCallback;
        progressCallback = delayInMs;
        delayInMs        = 0;
    }

    var start = Date.now() + delayInMs;
    var animationId = _animation_id++;

    function tick() {
        if (_animations[animationId]) {
            try {
                var percent = (Date.now() - start) / durationInMs;

                if (percent >= 1) {
                    stop(animationId);

                } else {
                    if ((percent > 0) && progressCallback) {
                        progressCallback(percent);
                    }

                    requestAnimationFrame(tick);
                }

            } catch (e) {
                if (_eventHandler) _eventHandler(e);
                stop(animationId);
            }
        }
    }

    _animations[animationId] = [ progressCallback, doneCallback ];

    requestAnimationFrame(tick);
    if (progressCallback) progressCallback(0);

    return animationId;
}
$.animate = animate;


function stop(animationId)
{
    var arr = _animations[animationId];
    if (!arr) return;

    var progressCallback = arr[0];
    var doneCallback     = arr[1];

    if (progressCallback) progressCallback(1.0);

    _animations[animationId] = null;
    if (doneCallback) doneCallback();

    if (_.every(_animations, function(value) {
        return value === null;
    })) {
        _animations = { };
    }
}
$.stop = stop;


function lerp(a, b, t) {
    return a + (b - a) * t;
}
$.lerp = lerp;


function ease(p) {
    p *= 5;

    if (p < 1) {
        return (-0.9 * Math.cos(p * (Math.PI / 2)) + 0.9 + (0.1 * p)) * 0.3;
    } else {
        p = ((p - 1) / 4);
        var p1 = p - 1;
        return (((p1 * p1 * p1 + 1) * 0.9) + p * 0.1) * 0.7 + 0.3;
    }
}
$.ease = ease;


// Approximate to cubic-bezier(0.42, 0.0, 1.0, 1.0)
function easeIn(p)
{
    return -0.9 * Math.cos(p * (Math.PI / 2)) + 0.9 + (0.1 * p);
}
$.easeIn = easeIn;


// Approximate to cubic-bezier(0.0, 0.0, 0.58, 1.0).
function easeOut(p)
{
    return (Math.sin(p * (Math.PI / 2)) * 0.9) + (0.1 * p);
}
$.easeOut = easeOut;


// Approximate to cubic-bezier(0.42, 0.0, 0.58, 1.0)
function easeInOut(p)
{
    return -0.5 * (Math.cos(Math.PI * p) - 1);
}
$.easeInOut = easeInOut;


$.transform = function(element, tx, ty, sx, sy, opacity)
{
    if (!element) return;

    var s;
    if ((sx !== undefined) && (sy !== undefined)) {
        s = (sx ? sx + "," : "0,") +
            (sy ? sy       : "0");
    }

    if (tx || ty || !s) {
        if (_.isNumber(tx)) tx = tx + "px";
        if (_.isNumber(ty)) ty = ty + "px";

        var t = (tx || "0") + "," + (ty || "0");
    }

    t = t ? "translate3d(" + t + ",0)" : "";
    s = s ?     "scale3d(" + s + ",1)" : "";

    if (!_transformName) {
        _transformName = _getCSSPropertyName("transform");
    }

    element.style[_transformName] = t + " " + s;

    if (opacity !== undefined) {
        element.style.opacity = String(opacity);
    }
}


$.setTransformOrigin = function(element, x, y)
{
    if (!_transformOriginName) {
        _transformOriginName = _getCSSPropertyName("transformOrigin");
    }

    element.style[_transformOriginName] = x + " " + y;
}


function setEventHandler(handler)
{
    _eventHandler = handler;
}
$.setEventHandler = setEventHandler;


function ready(callback)
{
    if (document.readyState != "loading") {
        setTimeout(callback, 0);

    } else {
        var listener = function() {
            document.removeEventListener("DOMContentLoaded", listener, false);
            callback();
        };

        document.addEventListener("DOMContentLoaded", listener, false);
    }
}
$.ready = ready;


root.eiko = root.$ = $;

}).call(null, this);

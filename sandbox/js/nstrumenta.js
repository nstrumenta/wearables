// The Module object: Our interface to the outside world. We import
// and export values on it. There are various ways Module can be used:
// 1. Not defined. We create it here
// 2. A function parameter, function(Module) { ..generated code.. }
// 3. pre-run appended it, var Module = {}; ..generated code..
// 4. External script tag defines var Module.
// We need to check if Module already exists (e.g. case 3 above).
// Substitution will be replaced with actual code on later stage of the build,
// this way Closure Compiler will not mangle it (e.g. case 4. above).
// Note that if you want to run closure, and also to use Module
// after the generated code, you will need to define   var Module = {};
// before the code. Then that object will be used in the code, and you
// can continue to use Module afterwards as well.
var Module = typeof Module !== 'undefined' ? Module : {};

// --pre-jses are emitted after the Module integration code, so that they can
// refer to Module (if they choose; they can also define Module)
// {{PRE_JSES}}

// Sometimes an existing Module object exists with properties
// meant to overwrite the default module functionality. Here
// we collect those properties and reapply _after_ we configure
// the current environment's defaults to avoid having to be so
// defensive during initialization.
var moduleOverrides = {};
var key;
for (key in Module) {
  if (Module.hasOwnProperty(key)) {
    moduleOverrides[key] = Module[key];
  }
}

Module['arguments'] = [];
Module['thisProgram'] = './this.program';
Module['quit'] = function(status, toThrow) {
  throw toThrow;
};
Module['preRun'] = [];
Module['postRun'] = [];

// The environment setup code below is customized to use Module.
// *** Environment setup code ***

var ENVIRONMENT_IS_WEB = false;
var ENVIRONMENT_IS_WORKER = false;
var ENVIRONMENT_IS_NODE = false;
var ENVIRONMENT_IS_SHELL = false;
ENVIRONMENT_IS_WEB = typeof window === 'object';
ENVIRONMENT_IS_WORKER = typeof importScripts === 'function';
ENVIRONMENT_IS_NODE = typeof process === 'object' && typeof require === 'function' && !ENVIRONMENT_IS_WEB && !ENVIRONMENT_IS_WORKER;
ENVIRONMENT_IS_SHELL = !ENVIRONMENT_IS_WEB && !ENVIRONMENT_IS_NODE && !ENVIRONMENT_IS_WORKER;

if (Module['ENVIRONMENT']) {
  throw new Error('Module.ENVIRONMENT has been deprecated. To force the environment, use the ENVIRONMENT compile-time option (for example, -s ENVIRONMENT=web or -s ENVIRONMENT=node)');
}

// Three configurations we can be running in:
// 1) We could be the application main() thread running in the main JS UI thread. (ENVIRONMENT_IS_WORKER == false and ENVIRONMENT_IS_PTHREAD == false)
// 2) We could be the application main() thread proxied to worker. (with Emscripten -s PROXY_TO_WORKER=1) (ENVIRONMENT_IS_WORKER == true, ENVIRONMENT_IS_PTHREAD == false)
// 3) We could be an application pthread running in a worker. (ENVIRONMENT_IS_WORKER == true and ENVIRONMENT_IS_PTHREAD == true)

if (ENVIRONMENT_IS_NODE) {


  // Expose functionality in the same simple way that the shells work
  // Note that we pollute the global namespace here, otherwise we break in node
  var nodeFS;
  var nodePath;

  Module['read'] = function shell_read(filename, binary) {
    var ret;
      if (!nodeFS) nodeFS = require('fs');
      if (!nodePath) nodePath = require('path');
      filename = nodePath['normalize'](filename);
      ret = nodeFS['readFileSync'](filename);
    return binary ? ret : ret.toString();
  };

  Module['readBinary'] = function readBinary(filename) {
    var ret = Module['read'](filename, true);
    if (!ret.buffer) {
      ret = new Uint8Array(ret);
    }
    assert(ret.buffer);
    return ret;
  };

  if (process['argv'].length > 1) {
    Module['thisProgram'] = process['argv'][1].replace(/\\/g, '/');
  }

  Module['arguments'] = process['argv'].slice(2);

  if (typeof module !== 'undefined') {
    module['exports'] = Module;
  }

  process['on']('uncaughtException', function(ex) {
    // suppress ExitStatus exceptions from showing an error
    if (!(ex instanceof ExitStatus)) {
      throw ex;
    }
  });
  // Currently node will swallow unhandled rejections, but this behavior is
  // deprecated, and in the future it will exit with error status.
  process['on']('unhandledRejection', function(reason, p) {
    err('node.js exiting due to unhandled promise rejection');
    process['exit'](1);
  });

  Module['quit'] = function(status) {
    process['exit'](status);
  };

  Module['inspect'] = function () { return '[Emscripten Module object]'; };
} else
if (ENVIRONMENT_IS_SHELL) {


  if (typeof read != 'undefined') {
    Module['read'] = function shell_read(f) {
      return read(f);
    };
  }

  Module['readBinary'] = function readBinary(f) {
    var data;
    if (typeof readbuffer === 'function') {
      return new Uint8Array(readbuffer(f));
    }
    data = read(f, 'binary');
    assert(typeof data === 'object');
    return data;
  };

  if (typeof scriptArgs != 'undefined') {
    Module['arguments'] = scriptArgs;
  } else if (typeof arguments != 'undefined') {
    Module['arguments'] = arguments;
  }

  if (typeof quit === 'function') {
    Module['quit'] = function(status) {
      quit(status);
    }
  }
} else
if (ENVIRONMENT_IS_WEB || ENVIRONMENT_IS_WORKER) {


  Module['read'] = function shell_read(url) {
      var xhr = new XMLHttpRequest();
      xhr.open('GET', url, false);
      xhr.send(null);
      return xhr.responseText;
  };

  if (ENVIRONMENT_IS_WORKER) {
    Module['readBinary'] = function readBinary(url) {
        var xhr = new XMLHttpRequest();
        xhr.open('GET', url, false);
        xhr.responseType = 'arraybuffer';
        xhr.send(null);
        return new Uint8Array(xhr.response);
    };
  }

  Module['readAsync'] = function readAsync(url, onload, onerror) {
    var xhr = new XMLHttpRequest();
    xhr.open('GET', url, true);
    xhr.responseType = 'arraybuffer';
    xhr.onload = function xhr_onload() {
      if (xhr.status == 200 || (xhr.status == 0 && xhr.response)) { // file URLs can return 0
        onload(xhr.response);
        return;
      }
      onerror();
    };
    xhr.onerror = onerror;
    xhr.send(null);
  };

  Module['setWindowTitle'] = function(title) { document.title = title };
} else
{
  throw new Error('environment detection error');
}

// Set up the out() and err() hooks, which are how we can print to stdout or
// stderr, respectively.
// If the user provided Module.print or printErr, use that. Otherwise,
// console.log is checked first, as 'print' on the web will open a print dialogue
// printErr is preferable to console.warn (works better in shells)
// bind(console) is necessary to fix IE/Edge closed dev tools panel behavior.
var out = Module['print'] || (typeof console !== 'undefined' ? console.log.bind(console) : (typeof print !== 'undefined' ? print : null));
var err = Module['printErr'] || (typeof printErr !== 'undefined' ? printErr : ((typeof console !== 'undefined' && console.warn.bind(console)) || out));

// *** Environment setup code ***

// Merge back in the overrides
for (key in moduleOverrides) {
  if (moduleOverrides.hasOwnProperty(key)) {
    Module[key] = moduleOverrides[key];
  }
}
// Free the object hierarchy contained in the overrides, this lets the GC
// reclaim data used e.g. in memoryInitializerRequest, which is a large typed array.
moduleOverrides = undefined;



// {{PREAMBLE_ADDITIONS}}

var STACK_ALIGN = 16;

// stack management, and other functionality that is provided by the compiled code,
// should not be used before it is ready
stackSave = stackRestore = stackAlloc = setTempRet0 = getTempRet0 = function() {
  abort('cannot use the stack before compiled code is ready to run, and has provided stack access');
};

function staticAlloc(size) {
  assert(!staticSealed);
  var ret = STATICTOP;
  STATICTOP = (STATICTOP + size + 15) & -16;
  assert(STATICTOP < TOTAL_MEMORY, 'not enough memory for static allocation - increase TOTAL_MEMORY');
  return ret;
}

function dynamicAlloc(size) {
  assert(DYNAMICTOP_PTR);
  var ret = HEAP32[DYNAMICTOP_PTR>>2];
  var end = (ret + size + 15) & -16;
  HEAP32[DYNAMICTOP_PTR>>2] = end;
  if (end >= TOTAL_MEMORY) {
    var success = enlargeMemory();
    if (!success) {
      HEAP32[DYNAMICTOP_PTR>>2] = ret;
      return 0;
    }
  }
  return ret;
}

function alignMemory(size, factor) {
  if (!factor) factor = STACK_ALIGN; // stack alignment (16-byte) by default
  var ret = size = Math.ceil(size / factor) * factor;
  return ret;
}

function getNativeTypeSize(type) {
  switch (type) {
    case 'i1': case 'i8': return 1;
    case 'i16': return 2;
    case 'i32': return 4;
    case 'i64': return 8;
    case 'float': return 4;
    case 'double': return 8;
    default: {
      if (type[type.length-1] === '*') {
        return 4; // A pointer
      } else if (type[0] === 'i') {
        var bits = parseInt(type.substr(1));
        assert(bits % 8 === 0);
        return bits / 8;
      } else {
        return 0;
      }
    }
  }
}

function warnOnce(text) {
  if (!warnOnce.shown) warnOnce.shown = {};
  if (!warnOnce.shown[text]) {
    warnOnce.shown[text] = 1;
    err(text);
  }
}

var asm2wasmImports = { // special asm2wasm imports
    "f64-rem": function(x, y) {
        return x % y;
    },
    "debugger": function() {
        debugger;
    }
};



var jsCallStartIndex = 1;
var functionPointers = new Array(0);

// 'sig' parameter is only used on LLVM wasm backend
function addFunction(func, sig) {
  if (typeof sig === 'undefined') {
    err('warning: addFunction(): You should provide a wasm function signature string as a second argument. This is not necessary for asm.js and asm2wasm, but is required for the LLVM wasm backend, so it is recommended for full portability.');
  }
  var base = 0;
  for (var i = base; i < base + 0; i++) {
    if (!functionPointers[i]) {
      functionPointers[i] = func;
      return jsCallStartIndex + i;
    }
  }
  throw 'Finished up all reserved function pointers. Use a higher value for RESERVED_FUNCTION_POINTERS.';
}

function removeFunction(index) {
  functionPointers[index-jsCallStartIndex] = null;
}

var funcWrappers = {};

function getFuncWrapper(func, sig) {
  if (!func) return; // on null pointer, return undefined
  assert(sig);
  if (!funcWrappers[sig]) {
    funcWrappers[sig] = {};
  }
  var sigCache = funcWrappers[sig];
  if (!sigCache[func]) {
    // optimize away arguments usage in common cases
    if (sig.length === 1) {
      sigCache[func] = function dynCall_wrapper() {
        return dynCall(sig, func);
      };
    } else if (sig.length === 2) {
      sigCache[func] = function dynCall_wrapper(arg) {
        return dynCall(sig, func, [arg]);
      };
    } else {
      // general case
      sigCache[func] = function dynCall_wrapper() {
        return dynCall(sig, func, Array.prototype.slice.call(arguments));
      };
    }
  }
  return sigCache[func];
}


function makeBigInt(low, high, unsigned) {
  return unsigned ? ((+((low>>>0)))+((+((high>>>0)))*4294967296.0)) : ((+((low>>>0)))+((+((high|0)))*4294967296.0));
}

function dynCall(sig, ptr, args) {
  if (args && args.length) {
    assert(args.length == sig.length-1);
    assert(('dynCall_' + sig) in Module, 'bad function pointer type - no table for sig \'' + sig + '\'');
    return Module['dynCall_' + sig].apply(null, [ptr].concat(args));
  } else {
    assert(sig.length == 1);
    assert(('dynCall_' + sig) in Module, 'bad function pointer type - no table for sig \'' + sig + '\'');
    return Module['dynCall_' + sig].call(null, ptr);
  }
}


function getCompilerSetting(name) {
  throw 'You must build with -s RETAIN_COMPILER_SETTINGS=1 for getCompilerSetting or emscripten_get_compiler_setting to work';
}

var Runtime = {
  // FIXME backwards compatibility layer for ports. Support some Runtime.*
  //       for now, fix it there, then remove it from here. That way we
  //       can minimize any period of breakage.
  dynCall: dynCall, // for SDL2 port
  // helpful errors
  getTempRet0: function() { abort('getTempRet0() is now a top-level function, after removing the Runtime object. Remove "Runtime."') },
  staticAlloc: function() { abort('staticAlloc() is now a top-level function, after removing the Runtime object. Remove "Runtime."') },
  stackAlloc: function() { abort('stackAlloc() is now a top-level function, after removing the Runtime object. Remove "Runtime."') },
};

// The address globals begin at. Very low in memory, for code size and optimization opportunities.
// Above 0 is static memory, starting with globals.
// Then the stack.
// Then 'dynamic' memory for sbrk.
var GLOBAL_BASE = 8;


// === Preamble library stuff ===

// Documentation for the public APIs defined in this file must be updated in:
//    site/source/docs/api_reference/preamble.js.rst
// A prebuilt local version of the documentation is available at:
//    site/build/text/docs/api_reference/preamble.js.txt
// You can also build docs locally as HTML or other formats in site/
// An online HTML version (which may be of a different version of Emscripten)
//    is up at http://kripken.github.io/emscripten-site/docs/api_reference/preamble.js.html



//========================================
// Runtime essentials
//========================================

var ABORT = 0; // whether we are quitting the application. no code should run after this. set in exit() and abort()
var EXITSTATUS = 0;

/** @type {function(*, string=)} */
function assert(condition, text) {
  if (!condition) {
    abort('Assertion failed: ' + text);
  }
}

var globalScope = this;

// Returns the C function with a specified identifier (for C++, you need to do manual name mangling)
function getCFunc(ident) {
  var func = Module['_' + ident]; // closure exported function
  assert(func, 'Cannot call unknown function ' + ident + ', make sure it is exported');
  return func;
}

var JSfuncs = {
  // Helpers for cwrap -- it can't refer to Runtime directly because it might
  // be renamed by closure, instead it calls JSfuncs['stackSave'].body to find
  // out what the minified function name is.
  'stackSave': function() {
    stackSave()
  },
  'stackRestore': function() {
    stackRestore()
  },
  // type conversion from js to c
  'arrayToC' : function(arr) {
    var ret = stackAlloc(arr.length);
    writeArrayToMemory(arr, ret);
    return ret;
  },
  'stringToC' : function(str) {
    var ret = 0;
    if (str !== null && str !== undefined && str !== 0) { // null string
      // at most 4 bytes per UTF-8 code point, +1 for the trailing '\0'
      var len = (str.length << 2) + 1;
      ret = stackAlloc(len);
      stringToUTF8(str, ret, len);
    }
    return ret;
  }
};

// For fast lookup of conversion functions
var toC = {
  'string': JSfuncs['stringToC'], 'array': JSfuncs['arrayToC']
};


// C calling interface.
function ccall(ident, returnType, argTypes, args, opts) {
  function convertReturnValue(ret) {
    if (returnType === 'string') return Pointer_stringify(ret);
    if (returnType === 'boolean') return Boolean(ret);
    return ret;
  }

  var func = getCFunc(ident);
  var cArgs = [];
  var stack = 0;
  assert(returnType !== 'array', 'Return type should not be "array".');
  if (args) {
    for (var i = 0; i < args.length; i++) {
      var converter = toC[argTypes[i]];
      if (converter) {
        if (stack === 0) stack = stackSave();
        cArgs[i] = converter(args[i]);
      } else {
        cArgs[i] = args[i];
      }
    }
  }
  var ret = func.apply(null, cArgs);
  ret = convertReturnValue(ret);
  if (stack !== 0) stackRestore(stack);
  return ret;
}

function cwrap(ident, returnType, argTypes, opts) {
  return function() {
    return ccall(ident, returnType, argTypes, arguments, opts);
  }
}

/** @type {function(number, number, string, boolean=)} */
function setValue(ptr, value, type, noSafe) {
  type = type || 'i8';
  if (type.charAt(type.length-1) === '*') type = 'i32'; // pointers are 32-bit
    switch(type) {
      case 'i1': HEAP8[((ptr)>>0)]=value; break;
      case 'i8': HEAP8[((ptr)>>0)]=value; break;
      case 'i16': HEAP16[((ptr)>>1)]=value; break;
      case 'i32': HEAP32[((ptr)>>2)]=value; break;
      case 'i64': (tempI64 = [value>>>0,(tempDouble=value,(+(Math_abs(tempDouble))) >= 1.0 ? (tempDouble > 0.0 ? ((Math_min((+(Math_floor((tempDouble)/4294967296.0))), 4294967295.0))|0)>>>0 : (~~((+(Math_ceil((tempDouble - +(((~~(tempDouble)))>>>0))/4294967296.0)))))>>>0) : 0)],HEAP32[((ptr)>>2)]=tempI64[0],HEAP32[(((ptr)+(4))>>2)]=tempI64[1]); break;
      case 'float': HEAPF32[((ptr)>>2)]=value; break;
      case 'double': HEAPF64[((ptr)>>3)]=value; break;
      default: abort('invalid type for setValue: ' + type);
    }
}

/** @type {function(number, string, boolean=)} */
function getValue(ptr, type, noSafe) {
  type = type || 'i8';
  if (type.charAt(type.length-1) === '*') type = 'i32'; // pointers are 32-bit
    switch(type) {
      case 'i1': return HEAP8[((ptr)>>0)];
      case 'i8': return HEAP8[((ptr)>>0)];
      case 'i16': return HEAP16[((ptr)>>1)];
      case 'i32': return HEAP32[((ptr)>>2)];
      case 'i64': return HEAP32[((ptr)>>2)];
      case 'float': return HEAPF32[((ptr)>>2)];
      case 'double': return HEAPF64[((ptr)>>3)];
      default: abort('invalid type for getValue: ' + type);
    }
  return null;
}

var ALLOC_NORMAL = 0; // Tries to use _malloc()
var ALLOC_STACK = 1; // Lives for the duration of the current function call
var ALLOC_STATIC = 2; // Cannot be freed
var ALLOC_DYNAMIC = 3; // Cannot be freed except through sbrk
var ALLOC_NONE = 4; // Do not allocate

// allocate(): This is for internal use. You can use it yourself as well, but the interface
//             is a little tricky (see docs right below). The reason is that it is optimized
//             for multiple syntaxes to save space in generated code. So you should
//             normally not use allocate(), and instead allocate memory using _malloc(),
//             initialize it with setValue(), and so forth.
// @slab: An array of data, or a number. If a number, then the size of the block to allocate,
//        in *bytes* (note that this is sometimes confusing: the next parameter does not
//        affect this!)
// @types: Either an array of types, one for each byte (or 0 if no type at that position),
//         or a single type which is used for the entire block. This only matters if there
//         is initial data - if @slab is a number, then this does not matter at all and is
//         ignored.
// @allocator: How to allocate memory, see ALLOC_*
/** @type {function((TypedArray|Array<number>|number), string, number, number=)} */
function allocate(slab, types, allocator, ptr) {
  var zeroinit, size;
  if (typeof slab === 'number') {
    zeroinit = true;
    size = slab;
  } else {
    zeroinit = false;
    size = slab.length;
  }

  var singleType = typeof types === 'string' ? types : null;

  var ret;
  if (allocator == ALLOC_NONE) {
    ret = ptr;
  } else {
    ret = [typeof _malloc === 'function' ? _malloc : staticAlloc, stackAlloc, staticAlloc, dynamicAlloc][allocator === undefined ? ALLOC_STATIC : allocator](Math.max(size, singleType ? 1 : types.length));
  }

  if (zeroinit) {
    var stop;
    ptr = ret;
    assert((ret & 3) == 0);
    stop = ret + (size & ~3);
    for (; ptr < stop; ptr += 4) {
      HEAP32[((ptr)>>2)]=0;
    }
    stop = ret + size;
    while (ptr < stop) {
      HEAP8[((ptr++)>>0)]=0;
    }
    return ret;
  }

  if (singleType === 'i8') {
    if (slab.subarray || slab.slice) {
      HEAPU8.set(/** @type {!Uint8Array} */ (slab), ret);
    } else {
      HEAPU8.set(new Uint8Array(slab), ret);
    }
    return ret;
  }

  var i = 0, type, typeSize, previousType;
  while (i < size) {
    var curr = slab[i];

    type = singleType || types[i];
    if (type === 0) {
      i++;
      continue;
    }
    assert(type, 'Must know what type to store in allocate!');

    if (type == 'i64') type = 'i32'; // special case: we have one i32 here, and one i32 later

    setValue(ret+i, curr, type);

    // no need to look up size unless type changes, so cache it
    if (previousType !== type) {
      typeSize = getNativeTypeSize(type);
      previousType = type;
    }
    i += typeSize;
  }

  return ret;
}

// Allocate memory during any stage of startup - static memory early on, dynamic memory later, malloc when ready
function getMemory(size) {
  if (!staticSealed) return staticAlloc(size);
  if (!runtimeInitialized) return dynamicAlloc(size);
  return _malloc(size);
}

/** @type {function(number, number=)} */
function Pointer_stringify(ptr, length) {
  if (length === 0 || !ptr) return '';
  // Find the length, and check for UTF while doing so
  var hasUtf = 0;
  var t;
  var i = 0;
  while (1) {
    assert(ptr + i < TOTAL_MEMORY);
    t = HEAPU8[(((ptr)+(i))>>0)];
    hasUtf |= t;
    if (t == 0 && !length) break;
    i++;
    if (length && i == length) break;
  }
  if (!length) length = i;

  var ret = '';

  if (hasUtf < 128) {
    var MAX_CHUNK = 1024; // split up into chunks, because .apply on a huge string can overflow the stack
    var curr;
    while (length > 0) {
      curr = String.fromCharCode.apply(String, HEAPU8.subarray(ptr, ptr + Math.min(length, MAX_CHUNK)));
      ret = ret ? ret + curr : curr;
      ptr += MAX_CHUNK;
      length -= MAX_CHUNK;
    }
    return ret;
  }
  return UTF8ToString(ptr);
}

// Given a pointer 'ptr' to a null-terminated ASCII-encoded string in the emscripten HEAP, returns
// a copy of that string as a Javascript String object.

function AsciiToString(ptr) {
  var str = '';
  while (1) {
    var ch = HEAP8[((ptr++)>>0)];
    if (!ch) return str;
    str += String.fromCharCode(ch);
  }
}

// Copies the given Javascript String object 'str' to the emscripten HEAP at address 'outPtr',
// null-terminated and encoded in ASCII form. The copy will require at most str.length+1 bytes of space in the HEAP.

function stringToAscii(str, outPtr) {
  return writeAsciiToMemory(str, outPtr, false);
}

// Given a pointer 'ptr' to a null-terminated UTF8-encoded string in the given array that contains uint8 values, returns
// a copy of that string as a Javascript String object.

var UTF8Decoder = typeof TextDecoder !== 'undefined' ? new TextDecoder('utf8') : undefined;
function UTF8ArrayToString(u8Array, idx) {
  var endPtr = idx;
  // TextDecoder needs to know the byte length in advance, it doesn't stop on null terminator by itself.
  // Also, use the length info to avoid running tiny strings through TextDecoder, since .subarray() allocates garbage.
  while (u8Array[endPtr]) ++endPtr;

  if (endPtr - idx > 16 && u8Array.subarray && UTF8Decoder) {
    return UTF8Decoder.decode(u8Array.subarray(idx, endPtr));
  } else {
    var u0, u1, u2, u3, u4, u5;

    var str = '';
    while (1) {
      // For UTF8 byte structure, see http://en.wikipedia.org/wiki/UTF-8#Description and https://www.ietf.org/rfc/rfc2279.txt and https://tools.ietf.org/html/rfc3629
      u0 = u8Array[idx++];
      if (!u0) return str;
      if (!(u0 & 0x80)) { str += String.fromCharCode(u0); continue; }
      u1 = u8Array[idx++] & 63;
      if ((u0 & 0xE0) == 0xC0) { str += String.fromCharCode(((u0 & 31) << 6) | u1); continue; }
      u2 = u8Array[idx++] & 63;
      if ((u0 & 0xF0) == 0xE0) {
        u0 = ((u0 & 15) << 12) | (u1 << 6) | u2;
      } else {
        u3 = u8Array[idx++] & 63;
        if ((u0 & 0xF8) == 0xF0) {
          u0 = ((u0 & 7) << 18) | (u1 << 12) | (u2 << 6) | u3;
        } else {
          u4 = u8Array[idx++] & 63;
          if ((u0 & 0xFC) == 0xF8) {
            u0 = ((u0 & 3) << 24) | (u1 << 18) | (u2 << 12) | (u3 << 6) | u4;
          } else {
            u5 = u8Array[idx++] & 63;
            u0 = ((u0 & 1) << 30) | (u1 << 24) | (u2 << 18) | (u3 << 12) | (u4 << 6) | u5;
          }
        }
      }
      if (u0 < 0x10000) {
        str += String.fromCharCode(u0);
      } else {
        var ch = u0 - 0x10000;
        str += String.fromCharCode(0xD800 | (ch >> 10), 0xDC00 | (ch & 0x3FF));
      }
    }
  }
}

// Given a pointer 'ptr' to a null-terminated UTF8-encoded string in the emscripten HEAP, returns
// a copy of that string as a Javascript String object.

function UTF8ToString(ptr) {
  return UTF8ArrayToString(HEAPU8,ptr);
}

// Copies the given Javascript String object 'str' to the given byte array at address 'outIdx',
// encoded in UTF8 form and null-terminated. The copy will require at most str.length*4+1 bytes of space in the HEAP.
// Use the function lengthBytesUTF8 to compute the exact number of bytes (excluding null terminator) that this function will write.
// Parameters:
//   str: the Javascript string to copy.
//   outU8Array: the array to copy to. Each index in this array is assumed to be one 8-byte element.
//   outIdx: The starting offset in the array to begin the copying.
//   maxBytesToWrite: The maximum number of bytes this function can write to the array. This count should include the null
//                    terminator, i.e. if maxBytesToWrite=1, only the null terminator will be written and nothing else.
//                    maxBytesToWrite=0 does not write any bytes to the output, not even the null terminator.
// Returns the number of bytes written, EXCLUDING the null terminator.

function stringToUTF8Array(str, outU8Array, outIdx, maxBytesToWrite) {
  if (!(maxBytesToWrite > 0)) // Parameter maxBytesToWrite is not optional. Negative values, 0, null, undefined and false each don't write out any bytes.
    return 0;

  var startIdx = outIdx;
  var endIdx = outIdx + maxBytesToWrite - 1; // -1 for string null terminator.
  for (var i = 0; i < str.length; ++i) {
    // Gotcha: charCodeAt returns a 16-bit word that is a UTF-16 encoded code unit, not a Unicode code point of the character! So decode UTF16->UTF32->UTF8.
    // See http://unicode.org/faq/utf_bom.html#utf16-3
    // For UTF8 byte structure, see http://en.wikipedia.org/wiki/UTF-8#Description and https://www.ietf.org/rfc/rfc2279.txt and https://tools.ietf.org/html/rfc3629
    var u = str.charCodeAt(i); // possibly a lead surrogate
    if (u >= 0xD800 && u <= 0xDFFF) u = 0x10000 + ((u & 0x3FF) << 10) | (str.charCodeAt(++i) & 0x3FF);
    if (u <= 0x7F) {
      if (outIdx >= endIdx) break;
      outU8Array[outIdx++] = u;
    } else if (u <= 0x7FF) {
      if (outIdx + 1 >= endIdx) break;
      outU8Array[outIdx++] = 0xC0 | (u >> 6);
      outU8Array[outIdx++] = 0x80 | (u & 63);
    } else if (u <= 0xFFFF) {
      if (outIdx + 2 >= endIdx) break;
      outU8Array[outIdx++] = 0xE0 | (u >> 12);
      outU8Array[outIdx++] = 0x80 | ((u >> 6) & 63);
      outU8Array[outIdx++] = 0x80 | (u & 63);
    } else if (u <= 0x1FFFFF) {
      if (outIdx + 3 >= endIdx) break;
      outU8Array[outIdx++] = 0xF0 | (u >> 18);
      outU8Array[outIdx++] = 0x80 | ((u >> 12) & 63);
      outU8Array[outIdx++] = 0x80 | ((u >> 6) & 63);
      outU8Array[outIdx++] = 0x80 | (u & 63);
    } else if (u <= 0x3FFFFFF) {
      if (outIdx + 4 >= endIdx) break;
      outU8Array[outIdx++] = 0xF8 | (u >> 24);
      outU8Array[outIdx++] = 0x80 | ((u >> 18) & 63);
      outU8Array[outIdx++] = 0x80 | ((u >> 12) & 63);
      outU8Array[outIdx++] = 0x80 | ((u >> 6) & 63);
      outU8Array[outIdx++] = 0x80 | (u & 63);
    } else {
      if (outIdx + 5 >= endIdx) break;
      outU8Array[outIdx++] = 0xFC | (u >> 30);
      outU8Array[outIdx++] = 0x80 | ((u >> 24) & 63);
      outU8Array[outIdx++] = 0x80 | ((u >> 18) & 63);
      outU8Array[outIdx++] = 0x80 | ((u >> 12) & 63);
      outU8Array[outIdx++] = 0x80 | ((u >> 6) & 63);
      outU8Array[outIdx++] = 0x80 | (u & 63);
    }
  }
  // Null-terminate the pointer to the buffer.
  outU8Array[outIdx] = 0;
  return outIdx - startIdx;
}

// Copies the given Javascript String object 'str' to the emscripten HEAP at address 'outPtr',
// null-terminated and encoded in UTF8 form. The copy will require at most str.length*4+1 bytes of space in the HEAP.
// Use the function lengthBytesUTF8 to compute the exact number of bytes (excluding null terminator) that this function will write.
// Returns the number of bytes written, EXCLUDING the null terminator.

function stringToUTF8(str, outPtr, maxBytesToWrite) {
  assert(typeof maxBytesToWrite == 'number', 'stringToUTF8(str, outPtr, maxBytesToWrite) is missing the third parameter that specifies the length of the output buffer!');
  return stringToUTF8Array(str, HEAPU8,outPtr, maxBytesToWrite);
}

// Returns the number of bytes the given Javascript string takes if encoded as a UTF8 byte array, EXCLUDING the null terminator byte.

function lengthBytesUTF8(str) {
  var len = 0;
  for (var i = 0; i < str.length; ++i) {
    // Gotcha: charCodeAt returns a 16-bit word that is a UTF-16 encoded code unit, not a Unicode code point of the character! So decode UTF16->UTF32->UTF8.
    // See http://unicode.org/faq/utf_bom.html#utf16-3
    var u = str.charCodeAt(i); // possibly a lead surrogate
    if (u >= 0xD800 && u <= 0xDFFF) u = 0x10000 + ((u & 0x3FF) << 10) | (str.charCodeAt(++i) & 0x3FF);
    if (u <= 0x7F) {
      ++len;
    } else if (u <= 0x7FF) {
      len += 2;
    } else if (u <= 0xFFFF) {
      len += 3;
    } else if (u <= 0x1FFFFF) {
      len += 4;
    } else if (u <= 0x3FFFFFF) {
      len += 5;
    } else {
      len += 6;
    }
  }
  return len;
}

// Given a pointer 'ptr' to a null-terminated UTF16LE-encoded string in the emscripten HEAP, returns
// a copy of that string as a Javascript String object.

var UTF16Decoder = typeof TextDecoder !== 'undefined' ? new TextDecoder('utf-16le') : undefined;
function UTF16ToString(ptr) {
  assert(ptr % 2 == 0, 'Pointer passed to UTF16ToString must be aligned to two bytes!');
  var endPtr = ptr;
  // TextDecoder needs to know the byte length in advance, it doesn't stop on null terminator by itself.
  // Also, use the length info to avoid running tiny strings through TextDecoder, since .subarray() allocates garbage.
  var idx = endPtr >> 1;
  while (HEAP16[idx]) ++idx;
  endPtr = idx << 1;

  if (endPtr - ptr > 32 && UTF16Decoder) {
    return UTF16Decoder.decode(HEAPU8.subarray(ptr, endPtr));
  } else {
    var i = 0;

    var str = '';
    while (1) {
      var codeUnit = HEAP16[(((ptr)+(i*2))>>1)];
      if (codeUnit == 0) return str;
      ++i;
      // fromCharCode constructs a character from a UTF-16 code unit, so we can pass the UTF16 string right through.
      str += String.fromCharCode(codeUnit);
    }
  }
}

// Copies the given Javascript String object 'str' to the emscripten HEAP at address 'outPtr',
// null-terminated and encoded in UTF16 form. The copy will require at most str.length*4+2 bytes of space in the HEAP.
// Use the function lengthBytesUTF16() to compute the exact number of bytes (excluding null terminator) that this function will write.
// Parameters:
//   str: the Javascript string to copy.
//   outPtr: Byte address in Emscripten HEAP where to write the string to.
//   maxBytesToWrite: The maximum number of bytes this function can write to the array. This count should include the null
//                    terminator, i.e. if maxBytesToWrite=2, only the null terminator will be written and nothing else.
//                    maxBytesToWrite<2 does not write any bytes to the output, not even the null terminator.
// Returns the number of bytes written, EXCLUDING the null terminator.

function stringToUTF16(str, outPtr, maxBytesToWrite) {
  assert(outPtr % 2 == 0, 'Pointer passed to stringToUTF16 must be aligned to two bytes!');
  assert(typeof maxBytesToWrite == 'number', 'stringToUTF16(str, outPtr, maxBytesToWrite) is missing the third parameter that specifies the length of the output buffer!');
  // Backwards compatibility: if max bytes is not specified, assume unsafe unbounded write is allowed.
  if (maxBytesToWrite === undefined) {
    maxBytesToWrite = 0x7FFFFFFF;
  }
  if (maxBytesToWrite < 2) return 0;
  maxBytesToWrite -= 2; // Null terminator.
  var startPtr = outPtr;
  var numCharsToWrite = (maxBytesToWrite < str.length*2) ? (maxBytesToWrite / 2) : str.length;
  for (var i = 0; i < numCharsToWrite; ++i) {
    // charCodeAt returns a UTF-16 encoded code unit, so it can be directly written to the HEAP.
    var codeUnit = str.charCodeAt(i); // possibly a lead surrogate
    HEAP16[((outPtr)>>1)]=codeUnit;
    outPtr += 2;
  }
  // Null-terminate the pointer to the HEAP.
  HEAP16[((outPtr)>>1)]=0;
  return outPtr - startPtr;
}

// Returns the number of bytes the given Javascript string takes if encoded as a UTF16 byte array, EXCLUDING the null terminator byte.

function lengthBytesUTF16(str) {
  return str.length*2;
}

function UTF32ToString(ptr) {
  assert(ptr % 4 == 0, 'Pointer passed to UTF32ToString must be aligned to four bytes!');
  var i = 0;

  var str = '';
  while (1) {
    var utf32 = HEAP32[(((ptr)+(i*4))>>2)];
    if (utf32 == 0)
      return str;
    ++i;
    // Gotcha: fromCharCode constructs a character from a UTF-16 encoded code (pair), not from a Unicode code point! So encode the code point to UTF-16 for constructing.
    // See http://unicode.org/faq/utf_bom.html#utf16-3
    if (utf32 >= 0x10000) {
      var ch = utf32 - 0x10000;
      str += String.fromCharCode(0xD800 | (ch >> 10), 0xDC00 | (ch & 0x3FF));
    } else {
      str += String.fromCharCode(utf32);
    }
  }
}

// Copies the given Javascript String object 'str' to the emscripten HEAP at address 'outPtr',
// null-terminated and encoded in UTF32 form. The copy will require at most str.length*4+4 bytes of space in the HEAP.
// Use the function lengthBytesUTF32() to compute the exact number of bytes (excluding null terminator) that this function will write.
// Parameters:
//   str: the Javascript string to copy.
//   outPtr: Byte address in Emscripten HEAP where to write the string to.
//   maxBytesToWrite: The maximum number of bytes this function can write to the array. This count should include the null
//                    terminator, i.e. if maxBytesToWrite=4, only the null terminator will be written and nothing else.
//                    maxBytesToWrite<4 does not write any bytes to the output, not even the null terminator.
// Returns the number of bytes written, EXCLUDING the null terminator.

function stringToUTF32(str, outPtr, maxBytesToWrite) {
  assert(outPtr % 4 == 0, 'Pointer passed to stringToUTF32 must be aligned to four bytes!');
  assert(typeof maxBytesToWrite == 'number', 'stringToUTF32(str, outPtr, maxBytesToWrite) is missing the third parameter that specifies the length of the output buffer!');
  // Backwards compatibility: if max bytes is not specified, assume unsafe unbounded write is allowed.
  if (maxBytesToWrite === undefined) {
    maxBytesToWrite = 0x7FFFFFFF;
  }
  if (maxBytesToWrite < 4) return 0;
  var startPtr = outPtr;
  var endPtr = startPtr + maxBytesToWrite - 4;
  for (var i = 0; i < str.length; ++i) {
    // Gotcha: charCodeAt returns a 16-bit word that is a UTF-16 encoded code unit, not a Unicode code point of the character! We must decode the string to UTF-32 to the heap.
    // See http://unicode.org/faq/utf_bom.html#utf16-3
    var codeUnit = str.charCodeAt(i); // possibly a lead surrogate
    if (codeUnit >= 0xD800 && codeUnit <= 0xDFFF) {
      var trailSurrogate = str.charCodeAt(++i);
      codeUnit = 0x10000 + ((codeUnit & 0x3FF) << 10) | (trailSurrogate & 0x3FF);
    }
    HEAP32[((outPtr)>>2)]=codeUnit;
    outPtr += 4;
    if (outPtr + 4 > endPtr) break;
  }
  // Null-terminate the pointer to the HEAP.
  HEAP32[((outPtr)>>2)]=0;
  return outPtr - startPtr;
}

// Returns the number of bytes the given Javascript string takes if encoded as a UTF16 byte array, EXCLUDING the null terminator byte.

function lengthBytesUTF32(str) {
  var len = 0;
  for (var i = 0; i < str.length; ++i) {
    // Gotcha: charCodeAt returns a 16-bit word that is a UTF-16 encoded code unit, not a Unicode code point of the character! We must decode the string to UTF-32 to the heap.
    // See http://unicode.org/faq/utf_bom.html#utf16-3
    var codeUnit = str.charCodeAt(i);
    if (codeUnit >= 0xD800 && codeUnit <= 0xDFFF) ++i; // possibly a lead surrogate, so skip over the tail surrogate.
    len += 4;
  }

  return len;
}

// Allocate heap space for a JS string, and write it there.
// It is the responsibility of the caller to free() that memory.
function allocateUTF8(str) {
  var size = lengthBytesUTF8(str) + 1;
  var ret = _malloc(size);
  if (ret) stringToUTF8Array(str, HEAP8, ret, size);
  return ret;
}

// Allocate stack space for a JS string, and write it there.
function allocateUTF8OnStack(str) {
  var size = lengthBytesUTF8(str) + 1;
  var ret = stackAlloc(size);
  stringToUTF8Array(str, HEAP8, ret, size);
  return ret;
}

function demangle(func) {
  warnOnce('warning: build with  -s DEMANGLE_SUPPORT=1  to link in libcxxabi demangling');
  return func;
}

function demangleAll(text) {
  var regex =
    /__Z[\w\d_]+/g;
  return text.replace(regex,
    function(x) {
      var y = demangle(x);
      return x === y ? x : (x + ' [' + y + ']');
    });
}

function jsStackTrace() {
  var err = new Error();
  if (!err.stack) {
    // IE10+ special cases: It does have callstack info, but it is only populated if an Error object is thrown,
    // so try that as a special-case.
    try {
      throw new Error(0);
    } catch(e) {
      err = e;
    }
    if (!err.stack) {
      return '(no stack trace available)';
    }
  }
  return err.stack.toString();
}

function stackTrace() {
  var js = jsStackTrace();
  if (Module['extraStackTrace']) js += '\n' + Module['extraStackTrace']();
  return demangleAll(js);
}

// Memory management

var PAGE_SIZE = 16384;
var WASM_PAGE_SIZE = 65536;
var ASMJS_PAGE_SIZE = 16777216;
var MIN_TOTAL_MEMORY = 16777216;

function alignUp(x, multiple) {
  if (x % multiple > 0) {
    x += multiple - (x % multiple);
  }
  return x;
}

var HEAP,
/** @type {ArrayBuffer} */
  buffer,
/** @type {Int8Array} */
  HEAP8,
/** @type {Uint8Array} */
  HEAPU8,
/** @type {Int16Array} */
  HEAP16,
/** @type {Uint16Array} */
  HEAPU16,
/** @type {Int32Array} */
  HEAP32,
/** @type {Uint32Array} */
  HEAPU32,
/** @type {Float32Array} */
  HEAPF32,
/** @type {Float64Array} */
  HEAPF64;

function updateGlobalBuffer(buf) {
  Module['buffer'] = buffer = buf;
}

function updateGlobalBufferViews() {
  Module['HEAP8'] = HEAP8 = new Int8Array(buffer);
  Module['HEAP16'] = HEAP16 = new Int16Array(buffer);
  Module['HEAP32'] = HEAP32 = new Int32Array(buffer);
  Module['HEAPU8'] = HEAPU8 = new Uint8Array(buffer);
  Module['HEAPU16'] = HEAPU16 = new Uint16Array(buffer);
  Module['HEAPU32'] = HEAPU32 = new Uint32Array(buffer);
  Module['HEAPF32'] = HEAPF32 = new Float32Array(buffer);
  Module['HEAPF64'] = HEAPF64 = new Float64Array(buffer);
}

var STATIC_BASE, STATICTOP, staticSealed; // static area
var STACK_BASE, STACKTOP, STACK_MAX; // stack area
var DYNAMIC_BASE, DYNAMICTOP_PTR; // dynamic area handled by sbrk

  STATIC_BASE = STATICTOP = STACK_BASE = STACKTOP = STACK_MAX = DYNAMIC_BASE = DYNAMICTOP_PTR = 0;
  staticSealed = false;


// Initializes the stack cookie. Called at the startup of main and at the startup of each thread in pthreads mode.
function writeStackCookie() {
  assert((STACK_MAX & 3) == 0);
  HEAPU32[(STACK_MAX >> 2)-1] = 0x02135467;
  HEAPU32[(STACK_MAX >> 2)-2] = 0x89BACDFE;
}

function checkStackCookie() {
  if (HEAPU32[(STACK_MAX >> 2)-1] != 0x02135467 || HEAPU32[(STACK_MAX >> 2)-2] != 0x89BACDFE) {
    abort('Stack overflow! Stack cookie has been overwritten, expected hex dwords 0x89BACDFE and 0x02135467, but received 0x' + HEAPU32[(STACK_MAX >> 2)-2].toString(16) + ' ' + HEAPU32[(STACK_MAX >> 2)-1].toString(16));
  }
  // Also test the global address 0 for integrity. This check is not compatible with SAFE_SPLIT_MEMORY though, since that mode already tests all address 0 accesses on its own.
  if (HEAP32[0] !== 0x63736d65 /* 'emsc' */) throw 'Runtime error: The application has corrupted its heap memory area (address zero)!';
}

function abortStackOverflow(allocSize) {
  abort('Stack overflow! Attempted to allocate ' + allocSize + ' bytes on the stack, but stack has only ' + (STACK_MAX - stackSave() + allocSize) + ' bytes available!');
}


function abortOnCannotGrowMemory() {
  abort('Cannot enlarge memory arrays. Either (1) compile with  -s TOTAL_MEMORY=X  with X higher than the current value ' + TOTAL_MEMORY + ', (2) compile with  -s ALLOW_MEMORY_GROWTH=1  which allows increasing the size at runtime but prevents some optimizations, (3) set Module.TOTAL_MEMORY to a higher value before the program runs, or (4) if you want malloc to return NULL (0) instead of this abort, compile with  -s ABORTING_MALLOC=0 ');
}


function enlargeMemory() {
  abortOnCannotGrowMemory();
}


var TOTAL_STACK = Module['TOTAL_STACK'] || 5242880;
var TOTAL_MEMORY = Module['TOTAL_MEMORY'] || 16777216;
if (TOTAL_MEMORY < TOTAL_STACK) err('TOTAL_MEMORY should be larger than TOTAL_STACK, was ' + TOTAL_MEMORY + '! (TOTAL_STACK=' + TOTAL_STACK + ')');

// Initialize the runtime's memory
// check for full engine support (use string 'subarray' to avoid closure compiler confusion)
assert(typeof Int32Array !== 'undefined' && typeof Float64Array !== 'undefined' && Int32Array.prototype.subarray !== undefined && Int32Array.prototype.set !== undefined,
       'JS engine does not provide full typed array support');



// Use a provided buffer, if there is one, or else allocate a new one
if (Module['buffer']) {
  buffer = Module['buffer'];
  assert(buffer.byteLength === TOTAL_MEMORY, 'provided buffer should be ' + TOTAL_MEMORY + ' bytes, but it is ' + buffer.byteLength);
} else {
  // Use a WebAssembly memory where available
  {
    buffer = new ArrayBuffer(TOTAL_MEMORY);
  }
  assert(buffer.byteLength === TOTAL_MEMORY);
  Module['buffer'] = buffer;
}
updateGlobalBufferViews();


function getTotalMemory() {
  return TOTAL_MEMORY;
}

// Endianness check (note: assumes compiler arch was little-endian)
  HEAP32[0] = 0x63736d65; /* 'emsc' */
HEAP16[1] = 0x6373;
if (HEAPU8[2] !== 0x73 || HEAPU8[3] !== 0x63) throw 'Runtime error: expected the system to be little-endian!';

function callRuntimeCallbacks(callbacks) {
  while(callbacks.length > 0) {
    var callback = callbacks.shift();
    if (typeof callback == 'function') {
      callback();
      continue;
    }
    var func = callback.func;
    if (typeof func === 'number') {
      if (callback.arg === undefined) {
        Module['dynCall_v'](func);
      } else {
        Module['dynCall_vi'](func, callback.arg);
      }
    } else {
      func(callback.arg === undefined ? null : callback.arg);
    }
  }
}

var __ATPRERUN__  = []; // functions called before the runtime is initialized
var __ATINIT__    = []; // functions called during startup
var __ATMAIN__    = []; // functions called when main() is to be run
var __ATEXIT__    = []; // functions called during shutdown
var __ATPOSTRUN__ = []; // functions called after the main() is called

var runtimeInitialized = false;
var runtimeExited = false;


function preRun() {
  // compatibility - merge in anything from Module['preRun'] at this time
  if (Module['preRun']) {
    if (typeof Module['preRun'] == 'function') Module['preRun'] = [Module['preRun']];
    while (Module['preRun'].length) {
      addOnPreRun(Module['preRun'].shift());
    }
  }
  callRuntimeCallbacks(__ATPRERUN__);
}

function ensureInitRuntime() {
  checkStackCookie();
  if (runtimeInitialized) return;
  runtimeInitialized = true;
  callRuntimeCallbacks(__ATINIT__);
}

function preMain() {
  checkStackCookie();
  callRuntimeCallbacks(__ATMAIN__);
}

function exitRuntime() {
  checkStackCookie();
  callRuntimeCallbacks(__ATEXIT__);
  runtimeExited = true;
}

function postRun() {
  checkStackCookie();
  // compatibility - merge in anything from Module['postRun'] at this time
  if (Module['postRun']) {
    if (typeof Module['postRun'] == 'function') Module['postRun'] = [Module['postRun']];
    while (Module['postRun'].length) {
      addOnPostRun(Module['postRun'].shift());
    }
  }
  callRuntimeCallbacks(__ATPOSTRUN__);
}

function addOnPreRun(cb) {
  __ATPRERUN__.unshift(cb);
}

function addOnInit(cb) {
  __ATINIT__.unshift(cb);
}

function addOnPreMain(cb) {
  __ATMAIN__.unshift(cb);
}

function addOnExit(cb) {
  __ATEXIT__.unshift(cb);
}

function addOnPostRun(cb) {
  __ATPOSTRUN__.unshift(cb);
}

// Deprecated: This function should not be called because it is unsafe and does not provide
// a maximum length limit of how many bytes it is allowed to write. Prefer calling the
// function stringToUTF8Array() instead, which takes in a maximum length that can be used
// to be secure from out of bounds writes.
/** @deprecated */
function writeStringToMemory(string, buffer, dontAddNull) {
  warnOnce('writeStringToMemory is deprecated and should not be called! Use stringToUTF8() instead!');

  var /** @type {number} */ lastChar, /** @type {number} */ end;
  if (dontAddNull) {
    // stringToUTF8Array always appends null. If we don't want to do that, remember the
    // character that existed at the location where the null will be placed, and restore
    // that after the write (below).
    end = buffer + lengthBytesUTF8(string);
    lastChar = HEAP8[end];
  }
  stringToUTF8(string, buffer, Infinity);
  if (dontAddNull) HEAP8[end] = lastChar; // Restore the value under the null character.
}

function writeArrayToMemory(array, buffer) {
  assert(array.length >= 0, 'writeArrayToMemory array must have a length (should be an array or typed array)')
  HEAP8.set(array, buffer);
}

function writeAsciiToMemory(str, buffer, dontAddNull) {
  for (var i = 0; i < str.length; ++i) {
    assert(str.charCodeAt(i) === str.charCodeAt(i)&0xff);
    HEAP8[((buffer++)>>0)]=str.charCodeAt(i);
  }
  // Null-terminate the pointer to the HEAP.
  if (!dontAddNull) HEAP8[((buffer)>>0)]=0;
}

function unSign(value, bits, ignore) {
  if (value >= 0) {
    return value;
  }
  return bits <= 32 ? 2*Math.abs(1 << (bits-1)) + value // Need some trickery, since if bits == 32, we are right at the limit of the bits JS uses in bitshifts
                    : Math.pow(2, bits)         + value;
}
function reSign(value, bits, ignore) {
  if (value <= 0) {
    return value;
  }
  var half = bits <= 32 ? Math.abs(1 << (bits-1)) // abs is needed if bits == 32
                        : Math.pow(2, bits-1);
  if (value >= half && (bits <= 32 || value > half)) { // for huge values, we can hit the precision limit and always get true here. so don't do that
                                                       // but, in general there is no perfect solution here. With 64-bit ints, we get rounding and errors
                                                       // TODO: In i64 mode 1, resign the two parts separately and safely
    value = -2*half + value; // Cannot bitshift half, as it may be at the limit of the bits JS uses in bitshifts
  }
  return value;
}

assert(Math['imul'] && Math['fround'] && Math['clz32'] && Math['trunc'], 'this is a legacy browser, build with LEGACY_VM_SUPPORT');

var Math_abs = Math.abs;
var Math_cos = Math.cos;
var Math_sin = Math.sin;
var Math_tan = Math.tan;
var Math_acos = Math.acos;
var Math_asin = Math.asin;
var Math_atan = Math.atan;
var Math_atan2 = Math.atan2;
var Math_exp = Math.exp;
var Math_log = Math.log;
var Math_sqrt = Math.sqrt;
var Math_ceil = Math.ceil;
var Math_floor = Math.floor;
var Math_pow = Math.pow;
var Math_imul = Math.imul;
var Math_fround = Math.fround;
var Math_round = Math.round;
var Math_min = Math.min;
var Math_max = Math.max;
var Math_clz32 = Math.clz32;
var Math_trunc = Math.trunc;

// A counter of dependencies for calling run(). If we need to
// do asynchronous work before running, increment this and
// decrement it. Incrementing must happen in a place like
// PRE_RUN_ADDITIONS (used by emcc to add file preloading).
// Note that you can add dependencies in preRun, even though
// it happens right before run - run will be postponed until
// the dependencies are met.
var runDependencies = 0;
var runDependencyWatcher = null;
var dependenciesFulfilled = null; // overridden to take different actions when all run dependencies are fulfilled
var runDependencyTracking = {};

function getUniqueRunDependency(id) {
  var orig = id;
  while (1) {
    if (!runDependencyTracking[id]) return id;
    id = orig + Math.random();
  }
  return id;
}

function addRunDependency(id) {
  runDependencies++;
  if (Module['monitorRunDependencies']) {
    Module['monitorRunDependencies'](runDependencies);
  }
  if (id) {
    assert(!runDependencyTracking[id]);
    runDependencyTracking[id] = 1;
    if (runDependencyWatcher === null && typeof setInterval !== 'undefined') {
      // Check for missing dependencies every few seconds
      runDependencyWatcher = setInterval(function() {
        if (ABORT) {
          clearInterval(runDependencyWatcher);
          runDependencyWatcher = null;
          return;
        }
        var shown = false;
        for (var dep in runDependencyTracking) {
          if (!shown) {
            shown = true;
            err('still waiting on run dependencies:');
          }
          err('dependency: ' + dep);
        }
        if (shown) {
          err('(end of list)');
        }
      }, 10000);
    }
  } else {
    err('warning: run dependency added without ID');
  }
}

function removeRunDependency(id) {
  runDependencies--;
  if (Module['monitorRunDependencies']) {
    Module['monitorRunDependencies'](runDependencies);
  }
  if (id) {
    assert(runDependencyTracking[id]);
    delete runDependencyTracking[id];
  } else {
    err('warning: run dependency removed without ID');
  }
  if (runDependencies == 0) {
    if (runDependencyWatcher !== null) {
      clearInterval(runDependencyWatcher);
      runDependencyWatcher = null;
    }
    if (dependenciesFulfilled) {
      var callback = dependenciesFulfilled;
      dependenciesFulfilled = null;
      callback(); // can add another dependenciesFulfilled
    }
  }
}

Module["preloadedImages"] = {}; // maps url to image data
Module["preloadedAudios"] = {}; // maps url to audio data



var memoryInitializer = null;



var /* show errors on likely calls to FS when it was not included */ FS = {
  error: function() {
    abort('Filesystem support (FS) was not included. The problem is that you are using files from JS, but files were not used from C/C++, so filesystem support was not auto-included. You can force-include filesystem support with  -s FORCE_FILESYSTEM=1');
  },
  init: function() { FS.error() },
  createDataFile: function() { FS.error() },
  createPreloadedFile: function() { FS.error() },
  createLazyFile: function() { FS.error() },
  open: function() { FS.error() },
  mkdev: function() { FS.error() },
  registerDevice: function() { FS.error() },
  analyzePath: function() { FS.error() },
  loadFilesFromDB: function() { FS.error() },

  ErrnoError: function ErrnoError() { FS.error() },
};
Module['FS_createDataFile'] = FS.createDataFile;
Module['FS_createPreloadedFile'] = FS.createPreloadedFile;



// Prefix of data URIs emitted by SINGLE_FILE and related options.
var dataURIPrefix = 'data:application/octet-stream;base64,';

// Indicates whether filename is a base64 data URI.
function isDataURI(filename) {
  return String.prototype.startsWith ?
      filename.startsWith(dataURIPrefix) :
      filename.indexOf(dataURIPrefix) === 0;
}





// === Body ===

var ASM_CONSTS = [function($0, $1) { Module.algorithmEvent = {}; Module.algorithmEvent.timestamp = $0; Module.algorithmEvent.id = $1; Module.algorithmEvent.values = []; },
 function($0) { Module.algorithmEvent.values.push($0); },
 function($0) { outputEventMsg(Module.algorithmEvent); }];

function _emscripten_asm_const_idi(code, a0, a1) {
  return ASM_CONSTS[code](a0, a1);
}

function _emscripten_asm_const_id(code, a0) {
  return ASM_CONSTS[code](a0);
}

function _emscripten_asm_const_ii(code, a0) {
  return ASM_CONSTS[code](a0);
}




STATIC_BASE = GLOBAL_BASE;

STATICTOP = STATIC_BASE + 5872;
/* global initializers */  __ATINIT__.push({ func: function() { __GLOBAL__sub_I_nstrumenta_cpp() } }, { func: function() { __GLOBAL__sub_I_bind_cpp() } });


/* memory initializer */ allocate([184,2,0,0,103,4,0,0,36,3,0,0,116,4,0,0,0,0,0,0,8,0,0,0,36,3,0,0,130,4,0,0,1,0,0,0,8,0,0,0,184,2,0,0,207,7,0,0,184,2,0,0,238,7,0,0,184,2,0,0,13,8,0,0,184,2,0,0,44,8,0,0,184,2,0,0,75,8,0,0,184,2,0,0,106,8,0,0,184,2,0,0,137,8,0,0,184,2,0,0,168,8,0,0,184,2,0,0,199,8,0,0,184,2,0,0,230,8,0,0,184,2,0,0,5,9,0,0,184,2,0,0,36,9,0,0,184,2,0,0,67,9,0,0,64,3,0,0,86,9,0,0,0,0,0,0,1,0,0,0,176,0,0,0,0,0,0,0,184,2,0,0,149,9,0,0,64,3,0,0,187,9,0,0,0,0,0,0,1,0,0,0,176,0,0,0,0,0,0,0,64,3,0,0,250,9,0,0,0,0,0,0,1,0,0,0,176,0,0,0,0,0,0,0,224,2,0,0,140,10,0,0,248,0,0,0,0,0,0,0,224,2,0,0,57,10,0,0,8,1,0,0,0,0,0,0,184,2,0,0,90,10,0,0,224,2,0,0,103,10,0,0,232,0,0,0,0,0,0,0,224,2,0,0,210,10,0,0,248,0,0,0,0,0,0,0,224,2,0,0,174,10,0,0,32,1,0,0,0,0,0,0,224,2,0,0,244,10,0,0,248,0,0,0,0,0,0,0,8,3,0,0,28,11,0,0,8,3,0,0,30,11,0,0,8,3,0,0,33,11,0,0,8,3,0,0,35,11,0,0,8,3,0,0,37,11,0,0,8,3,0,0,39,11,0,0,8,3,0,0,41,11,0,0,8,3,0,0,43,11,0,0,8,3,0,0,45,11,0,0,8,3,0,0,47,11,0,0,8,3,0,0,49,11,0,0,8,3,0,0,51,11,0,0,8,3,0,0,53,11,0,0,8,3,0,0,55,11,0,0,224,2,0,0,57,11,0,0,232,0,0,0,0,0,0,0,16,0,0,0,80,1,0,0,16,0,0,0,80,1,0,0,16,0,0,0,144,1,0,0,184,1,0,0,144,1,0,0,16,0,0,0,184,1,0,0,152,1,0,0,144,1,0,0,184,1,0,0,184,1,0,0,184,1,0,0,184,1,0,0,184,1,0,0,184,1,0,0,184,1,0,0,184,1,0,0,0,0,0,0,219,15,73,64,0,0,0,0,0,0,0,0,5,0,0,0,0,0,0,0,0,0,0,0,1,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,2,0,0,0,3,0,0,0,230,18,0,0,0,4,0,0,0,0,0,0,0,0,0,0,1,0,0,0,0,0,0,0,0,0,0,0,0,0,0,10,255,255,255,255,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,48,2,0,0,0,0,0,0,232,0,0,0,4,0,0,0,5,0,0,0,6,0,0,0,7,0,0,0,8,0,0,0,9,0,0,0,10,0,0,0,11,0,0,0,0,0,0,0,16,1,0,0,4,0,0,0,12,0,0,0,6,0,0,0,7,0,0,0,8,0,0,0,13,0,0,0,14,0,0,0,15,0,0,0,0,0,0,0,64,1,0,0,4,0,0,0,16,0,0,0,6,0,0,0,7,0,0,0,17,0,0,0,0,0,0,0,48,1,0,0,4,0,0,0,18,0,0,0,6,0,0,0,7,0,0,0,19,0,0,0,0,0,0,0,192,1,0,0,4,0,0,0,20,0,0,0,6,0,0,0,7,0,0,0,8,0,0,0,21,0,0,0,22,0,0,0,23,0,0,0,78,115,116,114,117,109,101,110,116,97,0,105,110,105,116,0,115,101,116,80,97,114,97,109,101,116,101,114,0,114,101,112,111,114,116,69,118,101,110,116,0,123,32,77,111,100,117,108,101,46,97,108,103,111,114,105,116,104,109,69,118,101,110,116,32,61,32,123,125,59,32,77,111,100,117,108,101,46,97,108,103,111,114,105,116,104,109,69,118,101,110,116,46,116,105,109,101,115,116,97,109,112,32,61,32,36,48,59,32,77,111,100,117,108,101,46,97,108,103,111,114,105,116,104,109,69,118,101,110,116,46,105,100,32,61,32,36,49,59,32,77,111,100,117,108,101,46,97,108,103,111,114,105,116,104,109,69,118,101,110,116,46,118,97,108,117,101,115,32,61,32,91,93,59,32,125,0,123,32,77,111,100,117,108,101,46,97,108,103,111,114,105,116,104,109,69,118,101,110,116,46,118,97,108,117,101,115,46,112,117,115,104,40,36,48,41,59,32,125,0,123,32,111,117,116,112,117,116,69,118,101,110,116,77,115,103,40,77,111,100,117,108,101,46,97,108,103,111,114,105,116,104,109,69,118,101,110,116,41,59,32,125,0,49,48,78,115,116,114,117,109,101,110,116,97,0,80,49,48,78,115,116,114,117,109,101,110,116,97,0,80,75,49,48,78,115,116,114,117,109,101,110,116,97,0,105,105,0,118,0,118,105,0,118,105,105,0,118,105,105,105,100,0,105,105,105,100,105,105,100,100,100,100,100,100,100,100,0,118,111,105,100,0,98,111,111,108,0,99,104,97,114,0,115,105,103,110,101,100,32,99,104,97,114,0,117,110,115,105,103,110,101,100,32,99,104,97,114,0,115,104,111,114,116,0,117,110,115,105,103,110,101,100,32,115,104,111,114,116,0,105,110,116,0,117,110,115,105,103,110,101,100,32,105,110,116,0,108,111,110,103,0,117,110,115,105,103,110,101,100,32,108,111,110,103,0,102,108,111,97,116,0,100,111,117,98,108,101,0,115,116,100,58,58,115,116,114,105,110,103,0,115,116,100,58,58,98,97,115,105,99,95,115,116,114,105,110,103,60,117,110,115,105,103,110,101,100,32,99,104,97,114,62,0,115,116,100,58,58,119,115,116,114,105,110,103,0,101,109,115,99,114,105,112,116,101,110,58,58,118,97,108,0,101,109,115,99,114,105,112,116,101,110,58,58,109,101,109,111,114,121,95,118,105,101,119,60,99,104,97,114,62,0,101,109,115,99,114,105,112,116,101,110,58,58,109,101,109,111,114,121,95,118,105,101,119,60,115,105,103,110,101,100,32,99,104,97,114,62,0,101,109,115,99,114,105,112,116,101,110,58,58,109,101,109,111,114,121,95,118,105,101,119,60,117,110,115,105,103,110,101,100,32,99,104,97,114,62,0,101,109,115,99,114,105,112,116,101,110,58,58,109,101,109,111,114,121,95,118,105,101,119,60,115,104,111,114,116,62,0,101,109,115,99,114,105,112,116,101,110,58,58,109,101,109,111,114,121,95,118,105,101,119,60,117,110,115,105,103,110,101,100,32,115,104,111,114,116,62,0,101,109,115,99,114,105,112,116,101,110,58,58,109,101,109,111,114,121,95,118,105,101,119,60,105,110,116,62,0,101,109,115,99,114,105,112,116,101,110,58,58,109,101,109,111,114,121,95,118,105,101,119,60,117,110,115,105,103,110,101,100,32,105,110,116,62,0,101,109,115,99,114,105,112,116,101,110,58,58,109,101,109,111,114,121,95,118,105,101,119,60,108,111,110,103,62,0,101,109,115,99,114,105,112,116,101,110,58,58,109,101,109,111,114,121,95,118,105,101,119,60,117,110,115,105,103,110,101,100,32,108,111,110,103,62,0,101,109,115,99,114,105,112,116,101,110,58,58,109,101,109,111,114,121,95,118,105,101,119,60,105,110,116,56,95,116,62,0,101,109,115,99,114,105,112,116,101,110,58,58,109,101,109,111,114,121,95,118,105,101,119,60,117,105,110,116,56,95,116,62,0,101,109,115,99,114,105,112,116,101,110,58,58,109,101,109,111,114,121,95,118,105,101,119,60,105,110,116,49,54,95,116,62,0,101,109,115,99,114,105,112,116,101,110,58,58,109,101,109,111,114,121,95,118,105,101,119,60,117,105,110,116,49,54,95,116,62,0,101,109,115,99,114,105,112,116,101,110,58,58,109,101,109,111,114,121,95,118,105,101,119,60,105,110,116,51,50,95,116,62,0,101,109,115,99,114,105,112,116,101,110,58,58,109,101,109,111,114,121,95,118,105,101,119,60,117,105,110,116,51,50,95,116,62,0,101,109,115,99,114,105,112,116,101,110,58,58,109,101,109,111,114,121,95,118,105,101,119,60,102,108,111,97,116,62,0,101,109,115,99,114,105,112,116,101,110,58,58,109,101,109,111,114,121,95,118,105,101,119,60,100,111,117,98,108,101,62,0,101,109,115,99,114,105,112,116,101,110,58,58,109,101,109,111,114,121,95,118,105,101,119,60,108,111,110,103,32,100,111,117,98,108,101,62,0,78,49,48,101,109,115,99,114,105,112,116,101,110,49,49,109,101,109,111,114,121,95,118,105,101,119,73,101,69,69,0,78,49,48,101,109,115,99,114,105,112,116,101,110,49,49,109,101,109,111,114,121,95,118,105,101,119,73,100,69,69,0,78,49,48,101,109,115,99,114,105,112,116,101,110,49,49,109,101,109,111,114,121,95,118,105,101,119,73,102,69,69,0,78,49,48,101,109,115,99,114,105,112,116,101,110,49,49,109,101,109,111,114,121,95,118,105,101,119,73,109,69,69,0,78,49,48,101,109,115,99,114,105,112,116,101,110,49,49,109,101,109,111,114,121,95,118,105,101,119,73,108,69,69,0,78,49,48,101,109,115,99,114,105,112,116,101,110,49,49,109,101,109,111,114,121,95,118,105,101,119,73,106,69,69,0,78,49,48,101,109,115,99,114,105,112,116,101,110,49,49,109,101,109,111,114,121,95,118,105,101,119,73,105,69,69,0,78,49,48,101,109,115,99,114,105,112,116,101,110,49,49,109,101,109,111,114,121,95,118,105,101,119,73,116,69,69,0,78,49,48,101,109,115,99,114,105,112,116,101,110,49,49,109,101,109,111,114,121,95,118,105,101,119,73,115,69,69,0,78,49,48,101,109,115,99,114,105,112,116,101,110,49,49,109,101,109,111,114,121,95,118,105,101,119,73,104,69,69,0,78,49,48,101,109,115,99,114,105,112,116,101,110,49,49,109,101,109,111,114,121,95,118,105,101,119,73,97,69,69,0,78,49,48,101,109,115,99,114,105,112,116,101,110,49,49,109,101,109,111,114,121,95,118,105,101,119,73,99,69,69,0,78,49,48,101,109,115,99,114,105,112,116,101,110,51,118,97,108,69,0,78,83,116,51,95,95,50,49,50,98,97,115,105,99,95,115,116,114,105,110,103,73,119,78,83,95,49,49,99,104,97,114,95,116,114,97,105,116,115,73,119,69,69,78,83,95,57,97,108,108,111,99,97,116,111,114,73,119,69,69,69,69,0,78,83,116,51,95,95,50,50,49,95,95,98,97,115,105,99,95,115,116,114,105,110,103,95,99,111,109,109,111,110,73,76,98,49,69,69,69,0,78,83,116,51,95,95,50,49,50,98,97,115,105,99,95,115,116,114,105,110,103,73,104,78,83,95,49,49,99,104,97,114,95,116,114,97,105,116,115,73,104,69,69,78,83,95,57,97,108,108,111,99,97,116,111,114,73,104,69,69,69,69,0,78,83,116,51,95,95,50,49,50,98,97,115,105,99,95,115,116,114,105,110,103,73,99,78,83,95,49,49,99,104,97,114,95,116,114,97,105,116,115,73,99,69,69,78,83,95,57,97,108,108,111,99,97,116,111,114,73,99,69,69,69,69,0,78,49,48,95,95,99,120,120,97,98,105,118,49,49,54,95,95,115,104,105,109,95,116,121,112,101,95,105,110,102,111,69,0,83,116,57,116,121,112,101,95,105,110,102,111,0,78,49,48,95,95,99,120,120,97,98,105,118,49,50,48,95,95,115,105,95,99,108,97,115,115,95,116,121,112,101,95,105,110,102,111,69,0,78,49,48,95,95,99,120,120,97,98,105,118,49,49,55,95,95,99,108,97,115,115,95,116,121,112,101,95,105,110,102,111,69,0,78,49,48,95,95,99,120,120,97,98,105,118,49,49,57,95,95,112,111,105,110,116,101,114,95,116,121,112,101,95,105,110,102,111,69,0,78,49,48,95,95,99,120,120,97,98,105,118,49,49,55,95,95,112,98,97,115,101,95,116,121,112,101,95,105,110,102,111,69,0,78,49,48,95,95,99,120,120,97,98,105,118,49,50,51,95,95,102,117,110,100,97,109,101,110,116,97,108,95,116,121,112,101,95,105,110,102,111,69,0,118,0,68,110,0,98,0,99,0,104,0,97,0,115,0,116,0,105,0,106,0,108,0,109,0,102,0,100,0,78,49,48,95,95,99,120,120,97,98,105,118,49,50,49,95,95,118,109,105,95,99,108,97,115,115,95,116,121,112,101,95,105,110,102,111,69,0], "i8", ALLOC_NONE, GLOBAL_BASE);





/* no memory initializer */
var tempDoublePtr = STATICTOP; STATICTOP += 16;

assert(tempDoublePtr % 8 == 0);

function copyTempFloat(ptr) { // functions, because inlining this code increases code size too much

  HEAP8[tempDoublePtr] = HEAP8[ptr];

  HEAP8[tempDoublePtr+1] = HEAP8[ptr+1];

  HEAP8[tempDoublePtr+2] = HEAP8[ptr+2];

  HEAP8[tempDoublePtr+3] = HEAP8[ptr+3];

}

function copyTempDouble(ptr) {

  HEAP8[tempDoublePtr] = HEAP8[ptr];

  HEAP8[tempDoublePtr+1] = HEAP8[ptr+1];

  HEAP8[tempDoublePtr+2] = HEAP8[ptr+2];

  HEAP8[tempDoublePtr+3] = HEAP8[ptr+3];

  HEAP8[tempDoublePtr+4] = HEAP8[ptr+4];

  HEAP8[tempDoublePtr+5] = HEAP8[ptr+5];

  HEAP8[tempDoublePtr+6] = HEAP8[ptr+6];

  HEAP8[tempDoublePtr+7] = HEAP8[ptr+7];

}

// {{PRE_LIBRARY}}


  
  function __ZSt18uncaught_exceptionv() { // std::uncaught_exception()
      return !!__ZSt18uncaught_exceptionv.uncaught_exception;
    }
  
  
  
  var EXCEPTIONS={last:0,caught:[],infos:{},deAdjust:function (adjusted) {
        if (!adjusted || EXCEPTIONS.infos[adjusted]) return adjusted;
        for (var key in EXCEPTIONS.infos) {
          var ptr = +key; // the iteration key is a string, and if we throw this, it must be an integer as that is what we look for
          var info = EXCEPTIONS.infos[ptr];
          if (info.adjusted === adjusted) {
            return ptr;
          }
        }
        return adjusted;
      },addRef:function (ptr) {
        if (!ptr) return;
        var info = EXCEPTIONS.infos[ptr];
        info.refcount++;
      },decRef:function (ptr) {
        if (!ptr) return;
        var info = EXCEPTIONS.infos[ptr];
        assert(info.refcount > 0);
        info.refcount--;
        // A rethrown exception can reach refcount 0; it must not be discarded
        // Its next handler will clear the rethrown flag and addRef it, prior to
        // final decRef and destruction here
        if (info.refcount === 0 && !info.rethrown) {
          if (info.destructor) {
            Module['dynCall_vi'](info.destructor, ptr);
          }
          delete EXCEPTIONS.infos[ptr];
          ___cxa_free_exception(ptr);
        }
      },clearRef:function (ptr) {
        if (!ptr) return;
        var info = EXCEPTIONS.infos[ptr];
        info.refcount = 0;
      }};
  function ___resumeException(ptr) {
      if (!EXCEPTIONS.last) { EXCEPTIONS.last = ptr; }
      throw ptr + " - Exception catching is disabled, this exception cannot be caught. Compile with -s DISABLE_EXCEPTION_CATCHING=0 or DISABLE_EXCEPTION_CATCHING=2 to catch.";
    }function ___cxa_find_matching_catch() {
      var thrown = EXCEPTIONS.last;
      if (!thrown) {
        // just pass through the null ptr
        return ((setTempRet0(0),0)|0);
      }
      var info = EXCEPTIONS.infos[thrown];
      var throwntype = info.type;
      if (!throwntype) {
        // just pass through the thrown ptr
        return ((setTempRet0(0),thrown)|0);
      }
      var typeArray = Array.prototype.slice.call(arguments);
  
      var pointer = Module['___cxa_is_pointer_type'](throwntype);
      // can_catch receives a **, add indirection
      if (!___cxa_find_matching_catch.buffer) ___cxa_find_matching_catch.buffer = _malloc(4);
      HEAP32[((___cxa_find_matching_catch.buffer)>>2)]=thrown;
      thrown = ___cxa_find_matching_catch.buffer;
      // The different catch blocks are denoted by different types.
      // Due to inheritance, those types may not precisely match the
      // type of the thrown object. Find one which matches, and
      // return the type of the catch block which should be called.
      for (var i = 0; i < typeArray.length; i++) {
        if (typeArray[i] && Module['___cxa_can_catch'](typeArray[i], throwntype, thrown)) {
          thrown = HEAP32[((thrown)>>2)]; // undo indirection
          info.adjusted = thrown;
          return ((setTempRet0(typeArray[i]),thrown)|0);
        }
      }
      // Shouldn't happen unless we have bogus data in typeArray
      // or encounter a type for which emscripten doesn't have suitable
      // typeinfo defined. Best-efforts match just in case.
      thrown = HEAP32[((thrown)>>2)]; // undo indirection
      return ((setTempRet0(throwntype),thrown)|0);
    }function ___gxx_personality_v0() {
    }

  function ___lock() {}

  
  var SYSCALLS={varargs:0,get:function (varargs) {
        SYSCALLS.varargs += 4;
        var ret = HEAP32[(((SYSCALLS.varargs)-(4))>>2)];
        return ret;
      },getStr:function () {
        var ret = Pointer_stringify(SYSCALLS.get());
        return ret;
      },get64:function () {
        var low = SYSCALLS.get(), high = SYSCALLS.get();
        if (low >= 0) assert(high === 0);
        else assert(high === -1);
        return low;
      },getZero:function () {
        assert(SYSCALLS.get() === 0);
      }};function ___syscall140(which, varargs) {SYSCALLS.varargs = varargs;
  try {
   // llseek
      var stream = SYSCALLS.getStreamFromFD(), offset_high = SYSCALLS.get(), offset_low = SYSCALLS.get(), result = SYSCALLS.get(), whence = SYSCALLS.get();
      // NOTE: offset_high is unused - Emscripten's off_t is 32-bit
      var offset = offset_low;
      FS.llseek(stream, offset, whence);
      HEAP32[((result)>>2)]=stream.position;
      if (stream.getdents && offset === 0 && whence === 0) stream.getdents = null; // reset readdir state
      return 0;
    } catch (e) {
    if (typeof FS === 'undefined' || !(e instanceof FS.ErrnoError)) abort(e);
    return -e.errno;
  }
  }

  
  function flush_NO_FILESYSTEM() {
      // flush anything remaining in the buffers during shutdown
      var fflush = Module["_fflush"];
      if (fflush) fflush(0);
      var printChar = ___syscall146.printChar;
      if (!printChar) return;
      var buffers = ___syscall146.buffers;
      if (buffers[1].length) printChar(1, 10);
      if (buffers[2].length) printChar(2, 10);
    }function ___syscall146(which, varargs) {SYSCALLS.varargs = varargs;
  try {
   // writev
      // hack to support printf in NO_FILESYSTEM
      var stream = SYSCALLS.get(), iov = SYSCALLS.get(), iovcnt = SYSCALLS.get();
      var ret = 0;
      if (!___syscall146.buffers) {
        ___syscall146.buffers = [null, [], []]; // 1 => stdout, 2 => stderr
        ___syscall146.printChar = function(stream, curr) {
          var buffer = ___syscall146.buffers[stream];
          assert(buffer);
          if (curr === 0 || curr === 10) {
            (stream === 1 ? out : err)(UTF8ArrayToString(buffer, 0));
            buffer.length = 0;
          } else {
            buffer.push(curr);
          }
        };
      }
      for (var i = 0; i < iovcnt; i++) {
        var ptr = HEAP32[(((iov)+(i*8))>>2)];
        var len = HEAP32[(((iov)+(i*8 + 4))>>2)];
        for (var j = 0; j < len; j++) {
          ___syscall146.printChar(stream, HEAPU8[ptr+j]);
        }
        ret += len;
      }
      return ret;
    } catch (e) {
    if (typeof FS === 'undefined' || !(e instanceof FS.ErrnoError)) abort(e);
    return -e.errno;
  }
  }

  function ___syscall54(which, varargs) {SYSCALLS.varargs = varargs;
  try {
   // ioctl
      return 0;
    } catch (e) {
    if (typeof FS === 'undefined' || !(e instanceof FS.ErrnoError)) abort(e);
    return -e.errno;
  }
  }

  function ___syscall6(which, varargs) {SYSCALLS.varargs = varargs;
  try {
   // close
      var stream = SYSCALLS.getStreamFromFD();
      FS.close(stream);
      return 0;
    } catch (e) {
    if (typeof FS === 'undefined' || !(e instanceof FS.ErrnoError)) abort(e);
    return -e.errno;
  }
  }

  function ___unlock() {}

  
  function getShiftFromSize(size) {
      switch (size) {
          case 1: return 0;
          case 2: return 1;
          case 4: return 2;
          case 8: return 3;
          default:
              throw new TypeError('Unknown type size: ' + size);
      }
    }
  
  
  
  function embind_init_charCodes() {
      var codes = new Array(256);
      for (var i = 0; i < 256; ++i) {
          codes[i] = String.fromCharCode(i);
      }
      embind_charCodes = codes;
    }var embind_charCodes=undefined;function readLatin1String(ptr) {
      var ret = "";
      var c = ptr;
      while (HEAPU8[c]) {
          ret += embind_charCodes[HEAPU8[c++]];
      }
      return ret;
    }
  
  
  var awaitingDependencies={};
  
  var registeredTypes={};
  
  var typeDependencies={};
  
  
  
  
  
  
  var char_0=48;
  
  var char_9=57;function makeLegalFunctionName(name) {
      if (undefined === name) {
          return '_unknown';
      }
      name = name.replace(/[^a-zA-Z0-9_]/g, '$');
      var f = name.charCodeAt(0);
      if (f >= char_0 && f <= char_9) {
          return '_' + name;
      } else {
          return name;
      }
    }function createNamedFunction(name, body) {
      name = makeLegalFunctionName(name);
      /*jshint evil:true*/
      return new Function(
          "body",
          "return function " + name + "() {\n" +
          "    \"use strict\";" +
          "    return body.apply(this, arguments);\n" +
          "};\n"
      )(body);
    }function extendError(baseErrorType, errorName) {
      var errorClass = createNamedFunction(errorName, function(message) {
          this.name = errorName;
          this.message = message;
  
          var stack = (new Error(message)).stack;
          if (stack !== undefined) {
              this.stack = this.toString() + '\n' +
                  stack.replace(/^Error(:[^\n]*)?\n/, '');
          }
      });
      errorClass.prototype = Object.create(baseErrorType.prototype);
      errorClass.prototype.constructor = errorClass;
      errorClass.prototype.toString = function() {
          if (this.message === undefined) {
              return this.name;
          } else {
              return this.name + ': ' + this.message;
          }
      };
  
      return errorClass;
    }var BindingError=undefined;function throwBindingError(message) {
      throw new BindingError(message);
    }
  
  
  
  var InternalError=undefined;function throwInternalError(message) {
      throw new InternalError(message);
    }function whenDependentTypesAreResolved(myTypes, dependentTypes, getTypeConverters) {
      myTypes.forEach(function(type) {
          typeDependencies[type] = dependentTypes;
      });
  
      function onComplete(typeConverters) {
          var myTypeConverters = getTypeConverters(typeConverters);
          if (myTypeConverters.length !== myTypes.length) {
              throwInternalError('Mismatched type converter count');
          }
          for (var i = 0; i < myTypes.length; ++i) {
              registerType(myTypes[i], myTypeConverters[i]);
          }
      }
  
      var typeConverters = new Array(dependentTypes.length);
      var unregisteredTypes = [];
      var registered = 0;
      dependentTypes.forEach(function(dt, i) {
          if (registeredTypes.hasOwnProperty(dt)) {
              typeConverters[i] = registeredTypes[dt];
          } else {
              unregisteredTypes.push(dt);
              if (!awaitingDependencies.hasOwnProperty(dt)) {
                  awaitingDependencies[dt] = [];
              }
              awaitingDependencies[dt].push(function() {
                  typeConverters[i] = registeredTypes[dt];
                  ++registered;
                  if (registered === unregisteredTypes.length) {
                      onComplete(typeConverters);
                  }
              });
          }
      });
      if (0 === unregisteredTypes.length) {
          onComplete(typeConverters);
      }
    }function registerType(rawType, registeredInstance, options) {
      options = options || {};
  
      if (!('argPackAdvance' in registeredInstance)) {
          throw new TypeError('registerType registeredInstance requires argPackAdvance');
      }
  
      var name = registeredInstance.name;
      if (!rawType) {
          throwBindingError('type "' + name + '" must have a positive integer typeid pointer');
      }
      if (registeredTypes.hasOwnProperty(rawType)) {
          if (options.ignoreDuplicateRegistrations) {
              return;
          } else {
              throwBindingError("Cannot register type '" + name + "' twice");
          }
      }
  
      registeredTypes[rawType] = registeredInstance;
      delete typeDependencies[rawType];
  
      if (awaitingDependencies.hasOwnProperty(rawType)) {
          var callbacks = awaitingDependencies[rawType];
          delete awaitingDependencies[rawType];
          callbacks.forEach(function(cb) {
              cb();
          });
      }
    }function __embind_register_bool(rawType, name, size, trueValue, falseValue) {
      var shift = getShiftFromSize(size);
  
      name = readLatin1String(name);
      registerType(rawType, {
          name: name,
          'fromWireType': function(wt) {
              // ambiguous emscripten ABI: sometimes return values are
              // true or false, and sometimes integers (0 or 1)
              return !!wt;
          },
          'toWireType': function(destructors, o) {
              return o ? trueValue : falseValue;
          },
          'argPackAdvance': 8,
          'readValueFromPointer': function(pointer) {
              // TODO: if heap is fixed (like in asm.js) this could be executed outside
              var heap;
              if (size === 1) {
                  heap = HEAP8;
              } else if (size === 2) {
                  heap = HEAP16;
              } else if (size === 4) {
                  heap = HEAP32;
              } else {
                  throw new TypeError("Unknown boolean type size: " + name);
              }
              return this['fromWireType'](heap[pointer >> shift]);
          },
          destructorFunction: null, // This type does not need a destructor
      });
    }

  
  
  
  function ClassHandle_isAliasOf(other) {
      if (!(this instanceof ClassHandle)) {
          return false;
      }
      if (!(other instanceof ClassHandle)) {
          return false;
      }
  
      var leftClass = this.$$.ptrType.registeredClass;
      var left = this.$$.ptr;
      var rightClass = other.$$.ptrType.registeredClass;
      var right = other.$$.ptr;
  
      while (leftClass.baseClass) {
          left = leftClass.upcast(left);
          leftClass = leftClass.baseClass;
      }
  
      while (rightClass.baseClass) {
          right = rightClass.upcast(right);
          rightClass = rightClass.baseClass;
      }
  
      return leftClass === rightClass && left === right;
    }
  
  
  function shallowCopyInternalPointer(o) {
      return {
          count: o.count,
          deleteScheduled: o.deleteScheduled,
          preservePointerOnDelete: o.preservePointerOnDelete,
          ptr: o.ptr,
          ptrType: o.ptrType,
          smartPtr: o.smartPtr,
          smartPtrType: o.smartPtrType,
      };
    }
  
  function throwInstanceAlreadyDeleted(obj) {
      function getInstanceTypeName(handle) {
        return handle.$$.ptrType.registeredClass.name;
      }
      throwBindingError(getInstanceTypeName(obj) + ' instance already deleted');
    }function ClassHandle_clone() {
      if (!this.$$.ptr) {
          throwInstanceAlreadyDeleted(this);
      }
  
      if (this.$$.preservePointerOnDelete) {
          this.$$.count.value += 1;
          return this;
      } else {
          var clone = Object.create(Object.getPrototypeOf(this), {
              $$: {
                  value: shallowCopyInternalPointer(this.$$),
              }
          });
  
          clone.$$.count.value += 1;
          clone.$$.deleteScheduled = false;
          return clone;
      }
    }
  
  
  function runDestructor(handle) {
      var $$ = handle.$$;
      if ($$.smartPtr) {
          $$.smartPtrType.rawDestructor($$.smartPtr);
      } else {
          $$.ptrType.registeredClass.rawDestructor($$.ptr);
      }
    }function ClassHandle_delete() {
      if (!this.$$.ptr) {
          throwInstanceAlreadyDeleted(this);
      }
  
      if (this.$$.deleteScheduled && !this.$$.preservePointerOnDelete) {
          throwBindingError('Object already scheduled for deletion');
      }
  
      this.$$.count.value -= 1;
      var toDelete = 0 === this.$$.count.value;
      if (toDelete) {
          runDestructor(this);
      }
      if (!this.$$.preservePointerOnDelete) {
          this.$$.smartPtr = undefined;
          this.$$.ptr = undefined;
      }
    }
  
  function ClassHandle_isDeleted() {
      return !this.$$.ptr;
    }
  
  
  var delayFunction=undefined;
  
  var deletionQueue=[];
  
  function flushPendingDeletes() {
      while (deletionQueue.length) {
          var obj = deletionQueue.pop();
          obj.$$.deleteScheduled = false;
          obj['delete']();
      }
    }function ClassHandle_deleteLater() {
      if (!this.$$.ptr) {
          throwInstanceAlreadyDeleted(this);
      }
      if (this.$$.deleteScheduled && !this.$$.preservePointerOnDelete) {
          throwBindingError('Object already scheduled for deletion');
      }
      deletionQueue.push(this);
      if (deletionQueue.length === 1 && delayFunction) {
          delayFunction(flushPendingDeletes);
      }
      this.$$.deleteScheduled = true;
      return this;
    }function init_ClassHandle() {
      ClassHandle.prototype['isAliasOf'] = ClassHandle_isAliasOf;
      ClassHandle.prototype['clone'] = ClassHandle_clone;
      ClassHandle.prototype['delete'] = ClassHandle_delete;
      ClassHandle.prototype['isDeleted'] = ClassHandle_isDeleted;
      ClassHandle.prototype['deleteLater'] = ClassHandle_deleteLater;
    }function ClassHandle() {
    }
  
  var registeredPointers={};
  
  
  function ensureOverloadTable(proto, methodName, humanName) {
      if (undefined === proto[methodName].overloadTable) {
          var prevFunc = proto[methodName];
          // Inject an overload resolver function that routes to the appropriate overload based on the number of arguments.
          proto[methodName] = function() {
              // TODO This check can be removed in -O3 level "unsafe" optimizations.
              if (!proto[methodName].overloadTable.hasOwnProperty(arguments.length)) {
                  throwBindingError("Function '" + humanName + "' called with an invalid number of arguments (" + arguments.length + ") - expects one of (" + proto[methodName].overloadTable + ")!");
              }
              return proto[methodName].overloadTable[arguments.length].apply(this, arguments);
          };
          // Move the previous function into the overload table.
          proto[methodName].overloadTable = [];
          proto[methodName].overloadTable[prevFunc.argCount] = prevFunc;
      }
    }function exposePublicSymbol(name, value, numArguments) {
      if (Module.hasOwnProperty(name)) {
          if (undefined === numArguments || (undefined !== Module[name].overloadTable && undefined !== Module[name].overloadTable[numArguments])) {
              throwBindingError("Cannot register public name '" + name + "' twice");
          }
  
          // We are exposing a function with the same name as an existing function. Create an overload table and a function selector
          // that routes between the two.
          ensureOverloadTable(Module, name, name);
          if (Module.hasOwnProperty(numArguments)) {
              throwBindingError("Cannot register multiple overloads of a function with the same number of arguments (" + numArguments + ")!");
          }
          // Add the new function into the overload table.
          Module[name].overloadTable[numArguments] = value;
      }
      else {
          Module[name] = value;
          if (undefined !== numArguments) {
              Module[name].numArguments = numArguments;
          }
      }
    }
  
  function RegisteredClass(
      name,
      constructor,
      instancePrototype,
      rawDestructor,
      baseClass,
      getActualType,
      upcast,
      downcast
    ) {
      this.name = name;
      this.constructor = constructor;
      this.instancePrototype = instancePrototype;
      this.rawDestructor = rawDestructor;
      this.baseClass = baseClass;
      this.getActualType = getActualType;
      this.upcast = upcast;
      this.downcast = downcast;
      this.pureVirtualFunctions = [];
    }
  
  
  
  function upcastPointer(ptr, ptrClass, desiredClass) {
      while (ptrClass !== desiredClass) {
          if (!ptrClass.upcast) {
              throwBindingError("Expected null or instance of " + desiredClass.name + ", got an instance of " + ptrClass.name);
          }
          ptr = ptrClass.upcast(ptr);
          ptrClass = ptrClass.baseClass;
      }
      return ptr;
    }function constNoSmartPtrRawPointerToWireType(destructors, handle) {
      if (handle === null) {
          if (this.isReference) {
              throwBindingError('null is not a valid ' + this.name);
          }
          return 0;
      }
  
      if (!handle.$$) {
          throwBindingError('Cannot pass "' + _embind_repr(handle) + '" as a ' + this.name);
      }
      if (!handle.$$.ptr) {
          throwBindingError('Cannot pass deleted object as a pointer of type ' + this.name);
      }
      var handleClass = handle.$$.ptrType.registeredClass;
      var ptr = upcastPointer(handle.$$.ptr, handleClass, this.registeredClass);
      return ptr;
    }
  
  function genericPointerToWireType(destructors, handle) {
      var ptr;
      if (handle === null) {
          if (this.isReference) {
              throwBindingError('null is not a valid ' + this.name);
          }
  
          if (this.isSmartPointer) {
              ptr = this.rawConstructor();
              if (destructors !== null) {
                  destructors.push(this.rawDestructor, ptr);
              }
              return ptr;
          } else {
              return 0;
          }
      }
  
      if (!handle.$$) {
          throwBindingError('Cannot pass "' + _embind_repr(handle) + '" as a ' + this.name);
      }
      if (!handle.$$.ptr) {
          throwBindingError('Cannot pass deleted object as a pointer of type ' + this.name);
      }
      if (!this.isConst && handle.$$.ptrType.isConst) {
          throwBindingError('Cannot convert argument of type ' + (handle.$$.smartPtrType ? handle.$$.smartPtrType.name : handle.$$.ptrType.name) + ' to parameter type ' + this.name);
      }
      var handleClass = handle.$$.ptrType.registeredClass;
      ptr = upcastPointer(handle.$$.ptr, handleClass, this.registeredClass);
  
      if (this.isSmartPointer) {
          // TODO: this is not strictly true
          // We could support BY_EMVAL conversions from raw pointers to smart pointers
          // because the smart pointer can hold a reference to the handle
          if (undefined === handle.$$.smartPtr) {
              throwBindingError('Passing raw pointer to smart pointer is illegal');
          }
  
          switch (this.sharingPolicy) {
              case 0: // NONE
                  // no upcasting
                  if (handle.$$.smartPtrType === this) {
                      ptr = handle.$$.smartPtr;
                  } else {
                      throwBindingError('Cannot convert argument of type ' + (handle.$$.smartPtrType ? handle.$$.smartPtrType.name : handle.$$.ptrType.name) + ' to parameter type ' + this.name);
                  }
                  break;
  
              case 1: // INTRUSIVE
                  ptr = handle.$$.smartPtr;
                  break;
  
              case 2: // BY_EMVAL
                  if (handle.$$.smartPtrType === this) {
                      ptr = handle.$$.smartPtr;
                  } else {
                      var clonedHandle = handle['clone']();
                      ptr = this.rawShare(
                          ptr,
                          __emval_register(function() {
                              clonedHandle['delete']();
                          })
                      );
                      if (destructors !== null) {
                          destructors.push(this.rawDestructor, ptr);
                      }
                  }
                  break;
  
              default:
                  throwBindingError('Unsupporting sharing policy');
          }
      }
      return ptr;
    }
  
  function nonConstNoSmartPtrRawPointerToWireType(destructors, handle) {
      if (handle === null) {
          if (this.isReference) {
              throwBindingError('null is not a valid ' + this.name);
          }
          return 0;
      }
  
      if (!handle.$$) {
          throwBindingError('Cannot pass "' + _embind_repr(handle) + '" as a ' + this.name);
      }
      if (!handle.$$.ptr) {
          throwBindingError('Cannot pass deleted object as a pointer of type ' + this.name);
      }
      if (handle.$$.ptrType.isConst) {
          throwBindingError('Cannot convert argument of type ' + handle.$$.ptrType.name + ' to parameter type ' + this.name);
      }
      var handleClass = handle.$$.ptrType.registeredClass;
      var ptr = upcastPointer(handle.$$.ptr, handleClass, this.registeredClass);
      return ptr;
    }
  
  
  function simpleReadValueFromPointer(pointer) {
      return this['fromWireType'](HEAPU32[pointer >> 2]);
    }
  
  function RegisteredPointer_getPointee(ptr) {
      if (this.rawGetPointee) {
          ptr = this.rawGetPointee(ptr);
      }
      return ptr;
    }
  
  function RegisteredPointer_destructor(ptr) {
      if (this.rawDestructor) {
          this.rawDestructor(ptr);
      }
    }
  
  function RegisteredPointer_deleteObject(handle) {
      if (handle !== null) {
          handle['delete']();
      }
    }
  
  
  function downcastPointer(ptr, ptrClass, desiredClass) {
      if (ptrClass === desiredClass) {
          return ptr;
      }
      if (undefined === desiredClass.baseClass) {
          return null; // no conversion
      }
  
      var rv = downcastPointer(ptr, ptrClass, desiredClass.baseClass);
      if (rv === null) {
          return null;
      }
      return desiredClass.downcast(rv);
    }
  
  
  
  
  function getInheritedInstanceCount() {
      return Object.keys(registeredInstances).length;
    }
  
  function getLiveInheritedInstances() {
      var rv = [];
      for (var k in registeredInstances) {
          if (registeredInstances.hasOwnProperty(k)) {
              rv.push(registeredInstances[k]);
          }
      }
      return rv;
    }
  
  function setDelayFunction(fn) {
      delayFunction = fn;
      if (deletionQueue.length && delayFunction) {
          delayFunction(flushPendingDeletes);
      }
    }function init_embind() {
      Module['getInheritedInstanceCount'] = getInheritedInstanceCount;
      Module['getLiveInheritedInstances'] = getLiveInheritedInstances;
      Module['flushPendingDeletes'] = flushPendingDeletes;
      Module['setDelayFunction'] = setDelayFunction;
    }var registeredInstances={};
  
  function getBasestPointer(class_, ptr) {
      if (ptr === undefined) {
          throwBindingError('ptr should not be undefined');
      }
      while (class_.baseClass) {
          ptr = class_.upcast(ptr);
          class_ = class_.baseClass;
      }
      return ptr;
    }function getInheritedInstance(class_, ptr) {
      ptr = getBasestPointer(class_, ptr);
      return registeredInstances[ptr];
    }
  
  function makeClassHandle(prototype, record) {
      if (!record.ptrType || !record.ptr) {
          throwInternalError('makeClassHandle requires ptr and ptrType');
      }
      var hasSmartPtrType = !!record.smartPtrType;
      var hasSmartPtr = !!record.smartPtr;
      if (hasSmartPtrType !== hasSmartPtr) {
          throwInternalError('Both smartPtrType and smartPtr must be specified');
      }
      record.count = { value: 1 };
      return Object.create(prototype, {
          $$: {
              value: record,
          },
      });
    }function RegisteredPointer_fromWireType(ptr) {
      // ptr is a raw pointer (or a raw smartpointer)
  
      // rawPointer is a maybe-null raw pointer
      var rawPointer = this.getPointee(ptr);
      if (!rawPointer) {
          this.destructor(ptr);
          return null;
      }
  
      var registeredInstance = getInheritedInstance(this.registeredClass, rawPointer);
      if (undefined !== registeredInstance) {
          // JS object has been neutered, time to repopulate it
          if (0 === registeredInstance.$$.count.value) {
              registeredInstance.$$.ptr = rawPointer;
              registeredInstance.$$.smartPtr = ptr;
              return registeredInstance['clone']();
          } else {
              // else, just increment reference count on existing object
              // it already has a reference to the smart pointer
              var rv = registeredInstance['clone']();
              this.destructor(ptr);
              return rv;
          }
      }
  
      function makeDefaultHandle() {
          if (this.isSmartPointer) {
              return makeClassHandle(this.registeredClass.instancePrototype, {
                  ptrType: this.pointeeType,
                  ptr: rawPointer,
                  smartPtrType: this,
                  smartPtr: ptr,
              });
          } else {
              return makeClassHandle(this.registeredClass.instancePrototype, {
                  ptrType: this,
                  ptr: ptr,
              });
          }
      }
  
      var actualType = this.registeredClass.getActualType(rawPointer);
      var registeredPointerRecord = registeredPointers[actualType];
      if (!registeredPointerRecord) {
          return makeDefaultHandle.call(this);
      }
  
      var toType;
      if (this.isConst) {
          toType = registeredPointerRecord.constPointerType;
      } else {
          toType = registeredPointerRecord.pointerType;
      }
      var dp = downcastPointer(
          rawPointer,
          this.registeredClass,
          toType.registeredClass);
      if (dp === null) {
          return makeDefaultHandle.call(this);
      }
      if (this.isSmartPointer) {
          return makeClassHandle(toType.registeredClass.instancePrototype, {
              ptrType: toType,
              ptr: dp,
              smartPtrType: this,
              smartPtr: ptr,
          });
      } else {
          return makeClassHandle(toType.registeredClass.instancePrototype, {
              ptrType: toType,
              ptr: dp,
          });
      }
    }function init_RegisteredPointer() {
      RegisteredPointer.prototype.getPointee = RegisteredPointer_getPointee;
      RegisteredPointer.prototype.destructor = RegisteredPointer_destructor;
      RegisteredPointer.prototype['argPackAdvance'] = 8;
      RegisteredPointer.prototype['readValueFromPointer'] = simpleReadValueFromPointer;
      RegisteredPointer.prototype['deleteObject'] = RegisteredPointer_deleteObject;
      RegisteredPointer.prototype['fromWireType'] = RegisteredPointer_fromWireType;
    }function RegisteredPointer(
      name,
      registeredClass,
      isReference,
      isConst,
  
      // smart pointer properties
      isSmartPointer,
      pointeeType,
      sharingPolicy,
      rawGetPointee,
      rawConstructor,
      rawShare,
      rawDestructor
    ) {
      this.name = name;
      this.registeredClass = registeredClass;
      this.isReference = isReference;
      this.isConst = isConst;
  
      // smart pointer properties
      this.isSmartPointer = isSmartPointer;
      this.pointeeType = pointeeType;
      this.sharingPolicy = sharingPolicy;
      this.rawGetPointee = rawGetPointee;
      this.rawConstructor = rawConstructor;
      this.rawShare = rawShare;
      this.rawDestructor = rawDestructor;
  
      if (!isSmartPointer && registeredClass.baseClass === undefined) {
          if (isConst) {
              this['toWireType'] = constNoSmartPtrRawPointerToWireType;
              this.destructorFunction = null;
          } else {
              this['toWireType'] = nonConstNoSmartPtrRawPointerToWireType;
              this.destructorFunction = null;
          }
      } else {
          this['toWireType'] = genericPointerToWireType;
          // Here we must leave this.destructorFunction undefined, since whether genericPointerToWireType returns
          // a pointer that needs to be freed up is runtime-dependent, and cannot be evaluated at registration time.
          // TODO: Create an alternative mechanism that allows removing the use of var destructors = []; array in
          //       craftInvokerFunction altogether.
      }
    }
  
  function replacePublicSymbol(name, value, numArguments) {
      if (!Module.hasOwnProperty(name)) {
          throwInternalError('Replacing nonexistant public symbol');
      }
      // If there's an overload table for this symbol, replace the symbol in the overload table instead.
      if (undefined !== Module[name].overloadTable && undefined !== numArguments) {
          Module[name].overloadTable[numArguments] = value;
      }
      else {
          Module[name] = value;
          Module[name].argCount = numArguments;
      }
    }
  
  function embind__requireFunction(signature, rawFunction) {
      signature = readLatin1String(signature);
  
      function makeDynCaller(dynCall) {
          var args = [];
          for (var i = 1; i < signature.length; ++i) {
              args.push('a' + i);
          }
  
          var name = 'dynCall_' + signature + '_' + rawFunction;
          var body = 'return function ' + name + '(' + args.join(', ') + ') {\n';
          body    += '    return dynCall(rawFunction' + (args.length ? ', ' : '') + args.join(', ') + ');\n';
          body    += '};\n';
  
          return (new Function('dynCall', 'rawFunction', body))(dynCall, rawFunction);
      }
  
      var fp;
      if (Module['FUNCTION_TABLE_' + signature] !== undefined) {
          fp = Module['FUNCTION_TABLE_' + signature][rawFunction];
      } else if (typeof FUNCTION_TABLE !== "undefined") {
          fp = FUNCTION_TABLE[rawFunction];
      } else {
          // asm.js does not give direct access to the function tables,
          // and thus we must go through the dynCall interface which allows
          // calling into a signature's function table by pointer value.
          //
          // https://github.com/dherman/asm.js/issues/83
          //
          // This has three main penalties:
          // - dynCall is another function call in the path from JavaScript to C++.
          // - JITs may not predict through the function table indirection at runtime.
          var dc = Module["asm"]['dynCall_' + signature];
          if (dc === undefined) {
              // We will always enter this branch if the signature
              // contains 'f' and PRECISE_F32 is not enabled.
              //
              // Try again, replacing 'f' with 'd'.
              dc = Module["asm"]['dynCall_' + signature.replace(/f/g, 'd')];
              if (dc === undefined) {
                  throwBindingError("No dynCall invoker for signature: " + signature);
              }
          }
          fp = makeDynCaller(dc);
      }
  
      if (typeof fp !== "function") {
          throwBindingError("unknown function pointer with signature " + signature + ": " + rawFunction);
      }
      return fp;
    }
  
  
  var UnboundTypeError=undefined;
  
  function getTypeName(type) {
      var ptr = ___getTypeName(type);
      var rv = readLatin1String(ptr);
      _free(ptr);
      return rv;
    }function throwUnboundTypeError(message, types) {
      var unboundTypes = [];
      var seen = {};
      function visit(type) {
          if (seen[type]) {
              return;
          }
          if (registeredTypes[type]) {
              return;
          }
          if (typeDependencies[type]) {
              typeDependencies[type].forEach(visit);
              return;
          }
          unboundTypes.push(type);
          seen[type] = true;
      }
      types.forEach(visit);
  
      throw new UnboundTypeError(message + ': ' + unboundTypes.map(getTypeName).join([', ']));
    }function __embind_register_class(
      rawType,
      rawPointerType,
      rawConstPointerType,
      baseClassRawType,
      getActualTypeSignature,
      getActualType,
      upcastSignature,
      upcast,
      downcastSignature,
      downcast,
      name,
      destructorSignature,
      rawDestructor
    ) {
      name = readLatin1String(name);
      getActualType = embind__requireFunction(getActualTypeSignature, getActualType);
      if (upcast) {
          upcast = embind__requireFunction(upcastSignature, upcast);
      }
      if (downcast) {
          downcast = embind__requireFunction(downcastSignature, downcast);
      }
      rawDestructor = embind__requireFunction(destructorSignature, rawDestructor);
      var legalFunctionName = makeLegalFunctionName(name);
  
      exposePublicSymbol(legalFunctionName, function() {
          // this code cannot run if baseClassRawType is zero
          throwUnboundTypeError('Cannot construct ' + name + ' due to unbound types', [baseClassRawType]);
      });
  
      whenDependentTypesAreResolved(
          [rawType, rawPointerType, rawConstPointerType],
          baseClassRawType ? [baseClassRawType] : [],
          function(base) {
              base = base[0];
  
              var baseClass;
              var basePrototype;
              if (baseClassRawType) {
                  baseClass = base.registeredClass;
                  basePrototype = baseClass.instancePrototype;
              } else {
                  basePrototype = ClassHandle.prototype;
              }
  
              var constructor = createNamedFunction(legalFunctionName, function() {
                  if (Object.getPrototypeOf(this) !== instancePrototype) {
                      throw new BindingError("Use 'new' to construct " + name);
                  }
                  if (undefined === registeredClass.constructor_body) {
                      throw new BindingError(name + " has no accessible constructor");
                  }
                  var body = registeredClass.constructor_body[arguments.length];
                  if (undefined === body) {
                      throw new BindingError("Tried to invoke ctor of " + name + " with invalid number of parameters (" + arguments.length + ") - expected (" + Object.keys(registeredClass.constructor_body).toString() + ") parameters instead!");
                  }
                  return body.apply(this, arguments);
              });
  
              var instancePrototype = Object.create(basePrototype, {
                  constructor: { value: constructor },
              });
  
              constructor.prototype = instancePrototype;
  
              var registeredClass = new RegisteredClass(
                  name,
                  constructor,
                  instancePrototype,
                  rawDestructor,
                  baseClass,
                  getActualType,
                  upcast,
                  downcast);
  
              var referenceConverter = new RegisteredPointer(
                  name,
                  registeredClass,
                  true,
                  false,
                  false);
  
              var pointerConverter = new RegisteredPointer(
                  name + '*',
                  registeredClass,
                  false,
                  false,
                  false);
  
              var constPointerConverter = new RegisteredPointer(
                  name + ' const*',
                  registeredClass,
                  false,
                  true,
                  false);
  
              registeredPointers[rawType] = {
                  pointerType: pointerConverter,
                  constPointerType: constPointerConverter
              };
  
              replacePublicSymbol(legalFunctionName, constructor);
  
              return [referenceConverter, pointerConverter, constPointerConverter];
          }
      );
    }

  
  function heap32VectorToArray(count, firstElement) {
      var array = [];
      for (var i = 0; i < count; i++) {
          array.push(HEAP32[(firstElement >> 2) + i]);
      }
      return array;
    }
  
  function runDestructors(destructors) {
      while (destructors.length) {
          var ptr = destructors.pop();
          var del = destructors.pop();
          del(ptr);
      }
    }function __embind_register_class_constructor(
      rawClassType,
      argCount,
      rawArgTypesAddr,
      invokerSignature,
      invoker,
      rawConstructor
    ) {
      var rawArgTypes = heap32VectorToArray(argCount, rawArgTypesAddr);
      invoker = embind__requireFunction(invokerSignature, invoker);
  
      whenDependentTypesAreResolved([], [rawClassType], function(classType) {
          classType = classType[0];
          var humanName = 'constructor ' + classType.name;
  
          if (undefined === classType.registeredClass.constructor_body) {
              classType.registeredClass.constructor_body = [];
          }
          if (undefined !== classType.registeredClass.constructor_body[argCount - 1]) {
              throw new BindingError("Cannot register multiple constructors with identical number of parameters (" + (argCount-1) + ") for class '" + classType.name + "'! Overload resolution is currently only performed using the parameter count, not actual type info!");
          }
          classType.registeredClass.constructor_body[argCount - 1] = function unboundTypeHandler() {
              throwUnboundTypeError('Cannot construct ' + classType.name + ' due to unbound types', rawArgTypes);
          };
  
          whenDependentTypesAreResolved([], rawArgTypes, function(argTypes) {
              classType.registeredClass.constructor_body[argCount - 1] = function constructor_body() {
                  if (arguments.length !== argCount - 1) {
                      throwBindingError(humanName + ' called with ' + arguments.length + ' arguments, expected ' + (argCount-1));
                  }
                  var destructors = [];
                  var args = new Array(argCount);
                  args[0] = rawConstructor;
                  for (var i = 1; i < argCount; ++i) {
                      args[i] = argTypes[i]['toWireType'](destructors, arguments[i - 1]);
                  }
  
                  var ptr = invoker.apply(null, args);
                  runDestructors(destructors);
  
                  return argTypes[0]['fromWireType'](ptr);
              };
              return [];
          });
          return [];
      });
    }

  
  
  function new_(constructor, argumentList) {
      if (!(constructor instanceof Function)) {
          throw new TypeError('new_ called with constructor type ' + typeof(constructor) + " which is not a function");
      }
  
      /*
       * Previously, the following line was just:
  
       function dummy() {};
  
       * Unfortunately, Chrome was preserving 'dummy' as the object's name, even though at creation, the 'dummy' has the
       * correct constructor name.  Thus, objects created with IMVU.new would show up in the debugger as 'dummy', which
       * isn't very helpful.  Using IMVU.createNamedFunction addresses the issue.  Doublely-unfortunately, there's no way
       * to write a test for this behavior.  -NRD 2013.02.22
       */
      var dummy = createNamedFunction(constructor.name || 'unknownFunctionName', function(){});
      dummy.prototype = constructor.prototype;
      var obj = new dummy;
  
      var r = constructor.apply(obj, argumentList);
      return (r instanceof Object) ? r : obj;
    }function craftInvokerFunction(humanName, argTypes, classType, cppInvokerFunc, cppTargetFunc) {
      // humanName: a human-readable string name for the function to be generated.
      // argTypes: An array that contains the embind type objects for all types in the function signature.
      //    argTypes[0] is the type object for the function return value.
      //    argTypes[1] is the type object for function this object/class type, or null if not crafting an invoker for a class method.
      //    argTypes[2...] are the actual function parameters.
      // classType: The embind type object for the class to be bound, or null if this is not a method of a class.
      // cppInvokerFunc: JS Function object to the C++-side function that interops into C++ code.
      // cppTargetFunc: Function pointer (an integer to FUNCTION_TABLE) to the target C++ function the cppInvokerFunc will end up calling.
      var argCount = argTypes.length;
  
      if (argCount < 2) {
          throwBindingError("argTypes array size mismatch! Must at least get return value and 'this' types!");
      }
  
      var isClassMethodFunc = (argTypes[1] !== null && classType !== null);
  
      // Free functions with signature "void function()" do not need an invoker that marshalls between wire types.
  // TODO: This omits argument count check - enable only at -O3 or similar.
  //    if (ENABLE_UNSAFE_OPTS && argCount == 2 && argTypes[0].name == "void" && !isClassMethodFunc) {
  //       return FUNCTION_TABLE[fn];
  //    }
  
  
      // Determine if we need to use a dynamic stack to store the destructors for the function parameters.
      // TODO: Remove this completely once all function invokers are being dynamically generated.
      var needsDestructorStack = false;
  
      for(var i = 1; i < argTypes.length; ++i) { // Skip return value at index 0 - it's not deleted here.
          if (argTypes[i] !== null && argTypes[i].destructorFunction === undefined) { // The type does not define a destructor function - must use dynamic stack
              needsDestructorStack = true;
              break;
          }
      }
  
      var returns = (argTypes[0].name !== "void");
  
      var argsList = "";
      var argsListWired = "";
      for(var i = 0; i < argCount - 2; ++i) {
          argsList += (i!==0?", ":"")+"arg"+i;
          argsListWired += (i!==0?", ":"")+"arg"+i+"Wired";
      }
  
      var invokerFnBody =
          "return function "+makeLegalFunctionName(humanName)+"("+argsList+") {\n" +
          "if (arguments.length !== "+(argCount - 2)+") {\n" +
              "throwBindingError('function "+humanName+" called with ' + arguments.length + ' arguments, expected "+(argCount - 2)+" args!');\n" +
          "}\n";
  
  
      if (needsDestructorStack) {
          invokerFnBody +=
              "var destructors = [];\n";
      }
  
      var dtorStack = needsDestructorStack ? "destructors" : "null";
      var args1 = ["throwBindingError", "invoker", "fn", "runDestructors", "retType", "classParam"];
      var args2 = [throwBindingError, cppInvokerFunc, cppTargetFunc, runDestructors, argTypes[0], argTypes[1]];
  
  
      if (isClassMethodFunc) {
          invokerFnBody += "var thisWired = classParam.toWireType("+dtorStack+", this);\n";
      }
  
      for(var i = 0; i < argCount - 2; ++i) {
          invokerFnBody += "var arg"+i+"Wired = argType"+i+".toWireType("+dtorStack+", arg"+i+"); // "+argTypes[i+2].name+"\n";
          args1.push("argType"+i);
          args2.push(argTypes[i+2]);
      }
  
      if (isClassMethodFunc) {
          argsListWired = "thisWired" + (argsListWired.length > 0 ? ", " : "") + argsListWired;
      }
  
      invokerFnBody +=
          (returns?"var rv = ":"") + "invoker(fn"+(argsListWired.length>0?", ":"")+argsListWired+");\n";
  
      if (needsDestructorStack) {
          invokerFnBody += "runDestructors(destructors);\n";
      } else {
          for(var i = isClassMethodFunc?1:2; i < argTypes.length; ++i) { // Skip return value at index 0 - it's not deleted here. Also skip class type if not a method.
              var paramName = (i === 1 ? "thisWired" : ("arg"+(i - 2)+"Wired"));
              if (argTypes[i].destructorFunction !== null) {
                  invokerFnBody += paramName+"_dtor("+paramName+"); // "+argTypes[i].name+"\n";
                  args1.push(paramName+"_dtor");
                  args2.push(argTypes[i].destructorFunction);
              }
          }
      }
  
      if (returns) {
          invokerFnBody += "var ret = retType.fromWireType(rv);\n" +
                           "return ret;\n";
      } else {
      }
      invokerFnBody += "}\n";
  
      args1.push(invokerFnBody);
  
      var invokerFunction = new_(Function, args1).apply(null, args2);
      return invokerFunction;
    }function __embind_register_class_function(
      rawClassType,
      methodName,
      argCount,
      rawArgTypesAddr, // [ReturnType, ThisType, Args...]
      invokerSignature,
      rawInvoker,
      context,
      isPureVirtual
    ) {
      var rawArgTypes = heap32VectorToArray(argCount, rawArgTypesAddr);
      methodName = readLatin1String(methodName);
      rawInvoker = embind__requireFunction(invokerSignature, rawInvoker);
  
      whenDependentTypesAreResolved([], [rawClassType], function(classType) {
          classType = classType[0];
          var humanName = classType.name + '.' + methodName;
  
          if (isPureVirtual) {
              classType.registeredClass.pureVirtualFunctions.push(methodName);
          }
  
          function unboundTypesHandler() {
              throwUnboundTypeError('Cannot call ' + humanName + ' due to unbound types', rawArgTypes);
          }
  
          var proto = classType.registeredClass.instancePrototype;
          var method = proto[methodName];
          if (undefined === method || (undefined === method.overloadTable && method.className !== classType.name && method.argCount === argCount - 2)) {
              // This is the first overload to be registered, OR we are replacing a function in the base class with a function in the derived class.
              unboundTypesHandler.argCount = argCount - 2;
              unboundTypesHandler.className = classType.name;
              proto[methodName] = unboundTypesHandler;
          } else {
              // There was an existing function with the same name registered. Set up a function overload routing table.
              ensureOverloadTable(proto, methodName, humanName);
              proto[methodName].overloadTable[argCount - 2] = unboundTypesHandler;
          }
  
          whenDependentTypesAreResolved([], rawArgTypes, function(argTypes) {
  
              var memberFunction = craftInvokerFunction(humanName, argTypes, classType, rawInvoker, context);
  
              // Replace the initial unbound-handler-stub function with the appropriate member function, now that all types
              // are resolved. If multiple overloads are registered for this function, the function goes into an overload table.
              if (undefined === proto[methodName].overloadTable) {
                  // Set argCount in case an overload is registered later
                  memberFunction.argCount = argCount - 2;
                  proto[methodName] = memberFunction;
              } else {
                  proto[methodName].overloadTable[argCount - 2] = memberFunction;
              }
  
              return [];
          });
          return [];
      });
    }

  
  
  var emval_free_list=[];
  
  var emval_handle_array=[{},{value:undefined},{value:null},{value:true},{value:false}];function __emval_decref(handle) {
      if (handle > 4 && 0 === --emval_handle_array[handle].refcount) {
          emval_handle_array[handle] = undefined;
          emval_free_list.push(handle);
      }
    }
  
  
  
  function count_emval_handles() {
      var count = 0;
      for (var i = 5; i < emval_handle_array.length; ++i) {
          if (emval_handle_array[i] !== undefined) {
              ++count;
          }
      }
      return count;
    }
  
  function get_first_emval() {
      for (var i = 5; i < emval_handle_array.length; ++i) {
          if (emval_handle_array[i] !== undefined) {
              return emval_handle_array[i];
          }
      }
      return null;
    }function init_emval() {
      Module['count_emval_handles'] = count_emval_handles;
      Module['get_first_emval'] = get_first_emval;
    }function __emval_register(value) {
  
      switch(value){
        case undefined :{ return 1; }
        case null :{ return 2; }
        case true :{ return 3; }
        case false :{ return 4; }
        default:{
          var handle = emval_free_list.length ?
              emval_free_list.pop() :
              emval_handle_array.length;
  
          emval_handle_array[handle] = {refcount: 1, value: value};
          return handle;
          }
        }
    }function __embind_register_emval(rawType, name) {
      name = readLatin1String(name);
      registerType(rawType, {
          name: name,
          'fromWireType': function(handle) {
              var rv = emval_handle_array[handle].value;
              __emval_decref(handle);
              return rv;
          },
          'toWireType': function(destructors, value) {
              return __emval_register(value);
          },
          'argPackAdvance': 8,
          'readValueFromPointer': simpleReadValueFromPointer,
          destructorFunction: null, // This type does not need a destructor
  
          // TODO: do we need a deleteObject here?  write a test where
          // emval is passed into JS via an interface
      });
    }

  
  function _embind_repr(v) {
      if (v === null) {
          return 'null';
      }
      var t = typeof v;
      if (t === 'object' || t === 'array' || t === 'function') {
          return v.toString();
      } else {
          return '' + v;
      }
    }
  
  function floatReadValueFromPointer(name, shift) {
      switch (shift) {
          case 2: return function(pointer) {
              return this['fromWireType'](HEAPF32[pointer >> 2]);
          };
          case 3: return function(pointer) {
              return this['fromWireType'](HEAPF64[pointer >> 3]);
          };
          default:
              throw new TypeError("Unknown float type: " + name);
      }
    }function __embind_register_float(rawType, name, size) {
      var shift = getShiftFromSize(size);
      name = readLatin1String(name);
      registerType(rawType, {
          name: name,
          'fromWireType': function(value) {
              return value;
          },
          'toWireType': function(destructors, value) {
              // todo: Here we have an opportunity for -O3 level "unsafe" optimizations: we could
              // avoid the following if() and assume value is of proper type.
              if (typeof value !== "number" && typeof value !== "boolean") {
                  throw new TypeError('Cannot convert "' + _embind_repr(value) + '" to ' + this.name);
              }
              return value;
          },
          'argPackAdvance': 8,
          'readValueFromPointer': floatReadValueFromPointer(name, shift),
          destructorFunction: null, // This type does not need a destructor
      });
    }

  
  function integerReadValueFromPointer(name, shift, signed) {
      // integers are quite common, so generate very specialized functions
      switch (shift) {
          case 0: return signed ?
              function readS8FromPointer(pointer) { return HEAP8[pointer]; } :
              function readU8FromPointer(pointer) { return HEAPU8[pointer]; };
          case 1: return signed ?
              function readS16FromPointer(pointer) { return HEAP16[pointer >> 1]; } :
              function readU16FromPointer(pointer) { return HEAPU16[pointer >> 1]; };
          case 2: return signed ?
              function readS32FromPointer(pointer) { return HEAP32[pointer >> 2]; } :
              function readU32FromPointer(pointer) { return HEAPU32[pointer >> 2]; };
          default:
              throw new TypeError("Unknown integer type: " + name);
      }
    }function __embind_register_integer(primitiveType, name, size, minRange, maxRange) {
      name = readLatin1String(name);
      if (maxRange === -1) { // LLVM doesn't have signed and unsigned 32-bit types, so u32 literals come out as 'i32 -1'. Always treat those as max u32.
          maxRange = 4294967295;
      }
  
      var shift = getShiftFromSize(size);
  
      var fromWireType = function(value) {
          return value;
      };
  
      if (minRange === 0) {
          var bitshift = 32 - 8*size;
          fromWireType = function(value) {
              return (value << bitshift) >>> bitshift;
          };
      }
  
      var isUnsignedType = (name.indexOf('unsigned') != -1);
  
      registerType(primitiveType, {
          name: name,
          'fromWireType': fromWireType,
          'toWireType': function(destructors, value) {
              // todo: Here we have an opportunity for -O3 level "unsafe" optimizations: we could
              // avoid the following two if()s and assume value is of proper type.
              if (typeof value !== "number" && typeof value !== "boolean") {
                  throw new TypeError('Cannot convert "' + _embind_repr(value) + '" to ' + this.name);
              }
              if (value < minRange || value > maxRange) {
                  throw new TypeError('Passing a number "' + _embind_repr(value) + '" from JS side to C/C++ side to an argument of type "' + name + '", which is outside the valid range [' + minRange + ', ' + maxRange + ']!');
              }
              return isUnsignedType ? (value >>> 0) : (value | 0);
          },
          'argPackAdvance': 8,
          'readValueFromPointer': integerReadValueFromPointer(name, shift, minRange !== 0),
          destructorFunction: null, // This type does not need a destructor
      });
    }

  function __embind_register_memory_view(rawType, dataTypeIndex, name) {
      var typeMapping = [
          Int8Array,
          Uint8Array,
          Int16Array,
          Uint16Array,
          Int32Array,
          Uint32Array,
          Float32Array,
          Float64Array,
      ];
  
      var TA = typeMapping[dataTypeIndex];
  
      function decodeMemoryView(handle) {
          handle = handle >> 2;
          var heap = HEAPU32;
          var size = heap[handle]; // in elements
          var data = heap[handle + 1]; // byte offset into emscripten heap
          return new TA(heap['buffer'], data, size);
      }
  
      name = readLatin1String(name);
      registerType(rawType, {
          name: name,
          'fromWireType': decodeMemoryView,
          'argPackAdvance': 8,
          'readValueFromPointer': decodeMemoryView,
      }, {
          ignoreDuplicateRegistrations: true,
      });
    }

  function __embind_register_std_string(rawType, name) {
      name = readLatin1String(name);
      registerType(rawType, {
          name: name,
          'fromWireType': function(value) {
              var length = HEAPU32[value >> 2];
              var a = new Array(length);
              for (var i = 0; i < length; ++i) {
                  a[i] = String.fromCharCode(HEAPU8[value + 4 + i]);
              }
              _free(value);
              return a.join('');
          },
          'toWireType': function(destructors, value) {
              if (value instanceof ArrayBuffer) {
                  value = new Uint8Array(value);
              }
  
              function getTAElement(ta, index) {
                  return ta[index];
              }
              function getStringElement(string, index) {
                  return string.charCodeAt(index);
              }
              var getElement;
              if (value instanceof Uint8Array) {
                  getElement = getTAElement;
              } else if (value instanceof Uint8ClampedArray) {
                  getElement = getTAElement;
              } else if (value instanceof Int8Array) {
                  getElement = getTAElement;
              } else if (typeof value === 'string') {
                  getElement = getStringElement;
              } else {
                  throwBindingError('Cannot pass non-string to std::string');
              }
  
              // assumes 4-byte alignment
              var length = value.length;
              var ptr = _malloc(4 + length);
              HEAPU32[ptr >> 2] = length;
              for (var i = 0; i < length; ++i) {
                  var charCode = getElement(value, i);
                  if (charCode > 255) {
                      _free(ptr);
                      throwBindingError('String has UTF-16 code units that do not fit in 8 bits');
                  }
                  HEAPU8[ptr + 4 + i] = charCode;
              }
              if (destructors !== null) {
                  destructors.push(_free, ptr);
              }
              return ptr;
          },
          'argPackAdvance': 8,
          'readValueFromPointer': simpleReadValueFromPointer,
          destructorFunction: function(ptr) { _free(ptr); },
      });
    }

  function __embind_register_std_wstring(rawType, charSize, name) {
      // nb. do not cache HEAPU16 and HEAPU32, they may be destroyed by enlargeMemory().
      name = readLatin1String(name);
      var getHeap, shift;
      if (charSize === 2) {
          getHeap = function() { return HEAPU16; };
          shift = 1;
      } else if (charSize === 4) {
          getHeap = function() { return HEAPU32; };
          shift = 2;
      }
      registerType(rawType, {
          name: name,
          'fromWireType': function(value) {
              var HEAP = getHeap();
              var length = HEAPU32[value >> 2];
              var a = new Array(length);
              var start = (value + 4) >> shift;
              for (var i = 0; i < length; ++i) {
                  a[i] = String.fromCharCode(HEAP[start + i]);
              }
              _free(value);
              return a.join('');
          },
          'toWireType': function(destructors, value) {
              // assumes 4-byte alignment
              var HEAP = getHeap();
              var length = value.length;
              var ptr = _malloc(4 + length * charSize);
              HEAPU32[ptr >> 2] = length;
              var start = (ptr + 4) >> shift;
              for (var i = 0; i < length; ++i) {
                  HEAP[start + i] = value.charCodeAt(i);
              }
              if (destructors !== null) {
                  destructors.push(_free, ptr);
              }
              return ptr;
          },
          'argPackAdvance': 8,
          'readValueFromPointer': simpleReadValueFromPointer,
          destructorFunction: function(ptr) { _free(ptr); },
      });
    }

  function __embind_register_void(rawType, name) {
      name = readLatin1String(name);
      registerType(rawType, {
          isVoid: true, // void return values can be optimized out sometimes
          name: name,
          'argPackAdvance': 0,
          'fromWireType': function() {
              return undefined;
          },
          'toWireType': function(destructors, o) {
              // TODO: assert if anything else is given?
              return undefined;
          },
      });
    }

  function _abort() {
      Module['abort']();
    }

  var _emscripten_asm_const_int=true;

  var _llvm_cos_f64=Math_cos;

  var _llvm_fabs_f64=Math_abs;

  var _llvm_log_f64=Math_log;

  var _llvm_sin_f64=Math_sin;

  var _llvm_sqrt_f32=Math_sqrt;

  var _llvm_sqrt_f64=Math_sqrt;

  
  function _emscripten_memcpy_big(dest, src, num) {
      HEAPU8.set(HEAPU8.subarray(src, src+num), dest);
      return dest;
    } 

   

  
  function ___setErrNo(value) {
      if (Module['___errno_location']) HEAP32[((Module['___errno_location']())>>2)]=value;
      else err('failed to set errno from JS');
      return value;
    } 
embind_init_charCodes();
BindingError = Module['BindingError'] = extendError(Error, 'BindingError');;
InternalError = Module['InternalError'] = extendError(Error, 'InternalError');;
init_ClassHandle();
init_RegisteredPointer();
init_embind();;
UnboundTypeError = Module['UnboundTypeError'] = extendError(Error, 'UnboundTypeError');;
init_emval();;
DYNAMICTOP_PTR = staticAlloc(4);

STACK_BASE = STACKTOP = alignMemory(STATICTOP);

STACK_MAX = STACK_BASE + TOTAL_STACK;

DYNAMIC_BASE = alignMemory(STACK_MAX);

HEAP32[DYNAMICTOP_PTR>>2] = DYNAMIC_BASE;

staticSealed = true; // seal the static portion of memory

assert(DYNAMIC_BASE < TOTAL_MEMORY, "TOTAL_MEMORY not big enough for stack");

var ASSERTIONS = true;

/** @type {function(string, boolean=, number=)} */
function intArrayFromString(stringy, dontAddNull, length) {
  var len = length > 0 ? length : lengthBytesUTF8(stringy)+1;
  var u8array = new Array(len);
  var numBytesWritten = stringToUTF8Array(stringy, u8array, 0, u8array.length);
  if (dontAddNull) u8array.length = numBytesWritten;
  return u8array;
}

function intArrayToString(array) {
  var ret = [];
  for (var i = 0; i < array.length; i++) {
    var chr = array[i];
    if (chr > 0xFF) {
      if (ASSERTIONS) {
        assert(false, 'Character code ' + chr + ' (' + String.fromCharCode(chr) + ')  at offset ' + i + ' not in 0x00-0xFF.');
      }
      chr &= 0xFF;
    }
    ret.push(String.fromCharCode(chr));
  }
  return ret.join('');
}



function nullFunc_i(x) { err("Invalid function pointer called with signature 'i'. Perhaps this is an invalid value (e.g. caused by calling a virtual method on a NULL pointer)? Or calling a function with an incorrect type, which will fail? (it is worth building your source files with -Werror (warnings are errors), as warnings can indicate undefined behavior which can cause this)");  err("Build with ASSERTIONS=2 for more info.");abort(x) }

function nullFunc_ii(x) { err("Invalid function pointer called with signature 'ii'. Perhaps this is an invalid value (e.g. caused by calling a virtual method on a NULL pointer)? Or calling a function with an incorrect type, which will fail? (it is worth building your source files with -Werror (warnings are errors), as warnings can indicate undefined behavior which can cause this)");  err("Build with ASSERTIONS=2 for more info.");abort(x) }

function nullFunc_iidiidddddddd(x) { err("Invalid function pointer called with signature 'iidiidddddddd'. Perhaps this is an invalid value (e.g. caused by calling a virtual method on a NULL pointer)? Or calling a function with an incorrect type, which will fail? (it is worth building your source files with -Werror (warnings are errors), as warnings can indicate undefined behavior which can cause this)");  err("Build with ASSERTIONS=2 for more info.");abort(x) }

function nullFunc_iiidiidddddddd(x) { err("Invalid function pointer called with signature 'iiidiidddddddd'. Perhaps this is an invalid value (e.g. caused by calling a virtual method on a NULL pointer)? Or calling a function with an incorrect type, which will fail? (it is worth building your source files with -Werror (warnings are errors), as warnings can indicate undefined behavior which can cause this)");  err("Build with ASSERTIONS=2 for more info.");abort(x) }

function nullFunc_iiii(x) { err("Invalid function pointer called with signature 'iiii'. Perhaps this is an invalid value (e.g. caused by calling a virtual method on a NULL pointer)? Or calling a function with an incorrect type, which will fail? (it is worth building your source files with -Werror (warnings are errors), as warnings can indicate undefined behavior which can cause this)");  err("Build with ASSERTIONS=2 for more info.");abort(x) }

function nullFunc_v(x) { err("Invalid function pointer called with signature 'v'. Perhaps this is an invalid value (e.g. caused by calling a virtual method on a NULL pointer)? Or calling a function with an incorrect type, which will fail? (it is worth building your source files with -Werror (warnings are errors), as warnings can indicate undefined behavior which can cause this)");  err("Build with ASSERTIONS=2 for more info.");abort(x) }

function nullFunc_vi(x) { err("Invalid function pointer called with signature 'vi'. Perhaps this is an invalid value (e.g. caused by calling a virtual method on a NULL pointer)? Or calling a function with an incorrect type, which will fail? (it is worth building your source files with -Werror (warnings are errors), as warnings can indicate undefined behavior which can cause this)");  err("Build with ASSERTIONS=2 for more info.");abort(x) }

function nullFunc_vii(x) { err("Invalid function pointer called with signature 'vii'. Perhaps this is an invalid value (e.g. caused by calling a virtual method on a NULL pointer)? Or calling a function with an incorrect type, which will fail? (it is worth building your source files with -Werror (warnings are errors), as warnings can indicate undefined behavior which can cause this)");  err("Build with ASSERTIONS=2 for more info.");abort(x) }

function nullFunc_viid(x) { err("Invalid function pointer called with signature 'viid'. Perhaps this is an invalid value (e.g. caused by calling a virtual method on a NULL pointer)? Or calling a function with an incorrect type, which will fail? (it is worth building your source files with -Werror (warnings are errors), as warnings can indicate undefined behavior which can cause this)");  err("Build with ASSERTIONS=2 for more info.");abort(x) }

function nullFunc_viiid(x) { err("Invalid function pointer called with signature 'viiid'. Perhaps this is an invalid value (e.g. caused by calling a virtual method on a NULL pointer)? Or calling a function with an incorrect type, which will fail? (it is worth building your source files with -Werror (warnings are errors), as warnings can indicate undefined behavior which can cause this)");  err("Build with ASSERTIONS=2 for more info.");abort(x) }

function nullFunc_viiii(x) { err("Invalid function pointer called with signature 'viiii'. Perhaps this is an invalid value (e.g. caused by calling a virtual method on a NULL pointer)? Or calling a function with an incorrect type, which will fail? (it is worth building your source files with -Werror (warnings are errors), as warnings can indicate undefined behavior which can cause this)");  err("Build with ASSERTIONS=2 for more info.");abort(x) }

function nullFunc_viiiii(x) { err("Invalid function pointer called with signature 'viiiii'. Perhaps this is an invalid value (e.g. caused by calling a virtual method on a NULL pointer)? Or calling a function with an incorrect type, which will fail? (it is worth building your source files with -Werror (warnings are errors), as warnings can indicate undefined behavior which can cause this)");  err("Build with ASSERTIONS=2 for more info.");abort(x) }

function nullFunc_viiiiii(x) { err("Invalid function pointer called with signature 'viiiiii'. Perhaps this is an invalid value (e.g. caused by calling a virtual method on a NULL pointer)? Or calling a function with an incorrect type, which will fail? (it is worth building your source files with -Werror (warnings are errors), as warnings can indicate undefined behavior which can cause this)");  err("Build with ASSERTIONS=2 for more info.");abort(x) }

function invoke_i(index) {
  var sp = stackSave();
  try {
    return Module["dynCall_i"](index);
  } catch(e) {
    stackRestore(sp);
    if (typeof e !== 'number' && e !== 'longjmp') throw e;
    Module["setThrew"](1, 0);
  }
}

function invoke_ii(index,a1) {
  var sp = stackSave();
  try {
    return Module["dynCall_ii"](index,a1);
  } catch(e) {
    stackRestore(sp);
    if (typeof e !== 'number' && e !== 'longjmp') throw e;
    Module["setThrew"](1, 0);
  }
}

function invoke_iidiidddddddd(index,a1,a2,a3,a4,a5,a6,a7,a8,a9,a10,a11,a12) {
  var sp = stackSave();
  try {
    return Module["dynCall_iidiidddddddd"](index,a1,a2,a3,a4,a5,a6,a7,a8,a9,a10,a11,a12);
  } catch(e) {
    stackRestore(sp);
    if (typeof e !== 'number' && e !== 'longjmp') throw e;
    Module["setThrew"](1, 0);
  }
}

function invoke_iiidiidddddddd(index,a1,a2,a3,a4,a5,a6,a7,a8,a9,a10,a11,a12,a13) {
  var sp = stackSave();
  try {
    return Module["dynCall_iiidiidddddddd"](index,a1,a2,a3,a4,a5,a6,a7,a8,a9,a10,a11,a12,a13);
  } catch(e) {
    stackRestore(sp);
    if (typeof e !== 'number' && e !== 'longjmp') throw e;
    Module["setThrew"](1, 0);
  }
}

function invoke_iiii(index,a1,a2,a3) {
  var sp = stackSave();
  try {
    return Module["dynCall_iiii"](index,a1,a2,a3);
  } catch(e) {
    stackRestore(sp);
    if (typeof e !== 'number' && e !== 'longjmp') throw e;
    Module["setThrew"](1, 0);
  }
}

function invoke_v(index) {
  var sp = stackSave();
  try {
    Module["dynCall_v"](index);
  } catch(e) {
    stackRestore(sp);
    if (typeof e !== 'number' && e !== 'longjmp') throw e;
    Module["setThrew"](1, 0);
  }
}

function invoke_vi(index,a1) {
  var sp = stackSave();
  try {
    Module["dynCall_vi"](index,a1);
  } catch(e) {
    stackRestore(sp);
    if (typeof e !== 'number' && e !== 'longjmp') throw e;
    Module["setThrew"](1, 0);
  }
}

function invoke_vii(index,a1,a2) {
  var sp = stackSave();
  try {
    Module["dynCall_vii"](index,a1,a2);
  } catch(e) {
    stackRestore(sp);
    if (typeof e !== 'number' && e !== 'longjmp') throw e;
    Module["setThrew"](1, 0);
  }
}

function invoke_viid(index,a1,a2,a3) {
  var sp = stackSave();
  try {
    Module["dynCall_viid"](index,a1,a2,a3);
  } catch(e) {
    stackRestore(sp);
    if (typeof e !== 'number' && e !== 'longjmp') throw e;
    Module["setThrew"](1, 0);
  }
}

function invoke_viiid(index,a1,a2,a3,a4) {
  var sp = stackSave();
  try {
    Module["dynCall_viiid"](index,a1,a2,a3,a4);
  } catch(e) {
    stackRestore(sp);
    if (typeof e !== 'number' && e !== 'longjmp') throw e;
    Module["setThrew"](1, 0);
  }
}

function invoke_viiii(index,a1,a2,a3,a4) {
  var sp = stackSave();
  try {
    Module["dynCall_viiii"](index,a1,a2,a3,a4);
  } catch(e) {
    stackRestore(sp);
    if (typeof e !== 'number' && e !== 'longjmp') throw e;
    Module["setThrew"](1, 0);
  }
}

function invoke_viiiii(index,a1,a2,a3,a4,a5) {
  var sp = stackSave();
  try {
    Module["dynCall_viiiii"](index,a1,a2,a3,a4,a5);
  } catch(e) {
    stackRestore(sp);
    if (typeof e !== 'number' && e !== 'longjmp') throw e;
    Module["setThrew"](1, 0);
  }
}

function invoke_viiiiii(index,a1,a2,a3,a4,a5,a6) {
  var sp = stackSave();
  try {
    Module["dynCall_viiiiii"](index,a1,a2,a3,a4,a5,a6);
  } catch(e) {
    stackRestore(sp);
    if (typeof e !== 'number' && e !== 'longjmp') throw e;
    Module["setThrew"](1, 0);
  }
}

Module.asmGlobalArg = { "Math": Math, "Int8Array": Int8Array, "Int16Array": Int16Array, "Int32Array": Int32Array, "Uint8Array": Uint8Array, "Uint16Array": Uint16Array, "Uint32Array": Uint32Array, "Float32Array": Float32Array, "Float64Array": Float64Array, "NaN": NaN, "Infinity": Infinity };

Module.asmLibraryArg = { "abort": abort, "assert": assert, "enlargeMemory": enlargeMemory, "getTotalMemory": getTotalMemory, "abortOnCannotGrowMemory": abortOnCannotGrowMemory, "abortStackOverflow": abortStackOverflow, "nullFunc_i": nullFunc_i, "nullFunc_ii": nullFunc_ii, "nullFunc_iidiidddddddd": nullFunc_iidiidddddddd, "nullFunc_iiidiidddddddd": nullFunc_iiidiidddddddd, "nullFunc_iiii": nullFunc_iiii, "nullFunc_v": nullFunc_v, "nullFunc_vi": nullFunc_vi, "nullFunc_vii": nullFunc_vii, "nullFunc_viid": nullFunc_viid, "nullFunc_viiid": nullFunc_viiid, "nullFunc_viiii": nullFunc_viiii, "nullFunc_viiiii": nullFunc_viiiii, "nullFunc_viiiiii": nullFunc_viiiiii, "invoke_i": invoke_i, "invoke_ii": invoke_ii, "invoke_iidiidddddddd": invoke_iidiidddddddd, "invoke_iiidiidddddddd": invoke_iiidiidddddddd, "invoke_iiii": invoke_iiii, "invoke_v": invoke_v, "invoke_vi": invoke_vi, "invoke_vii": invoke_vii, "invoke_viid": invoke_viid, "invoke_viiid": invoke_viiid, "invoke_viiii": invoke_viiii, "invoke_viiiii": invoke_viiiii, "invoke_viiiiii": invoke_viiiiii, "ClassHandle": ClassHandle, "ClassHandle_clone": ClassHandle_clone, "ClassHandle_delete": ClassHandle_delete, "ClassHandle_deleteLater": ClassHandle_deleteLater, "ClassHandle_isAliasOf": ClassHandle_isAliasOf, "ClassHandle_isDeleted": ClassHandle_isDeleted, "RegisteredClass": RegisteredClass, "RegisteredPointer": RegisteredPointer, "RegisteredPointer_deleteObject": RegisteredPointer_deleteObject, "RegisteredPointer_destructor": RegisteredPointer_destructor, "RegisteredPointer_fromWireType": RegisteredPointer_fromWireType, "RegisteredPointer_getPointee": RegisteredPointer_getPointee, "__ZSt18uncaught_exceptionv": __ZSt18uncaught_exceptionv, "___cxa_find_matching_catch": ___cxa_find_matching_catch, "___gxx_personality_v0": ___gxx_personality_v0, "___lock": ___lock, "___resumeException": ___resumeException, "___setErrNo": ___setErrNo, "___syscall140": ___syscall140, "___syscall146": ___syscall146, "___syscall54": ___syscall54, "___syscall6": ___syscall6, "___unlock": ___unlock, "__embind_register_bool": __embind_register_bool, "__embind_register_class": __embind_register_class, "__embind_register_class_constructor": __embind_register_class_constructor, "__embind_register_class_function": __embind_register_class_function, "__embind_register_emval": __embind_register_emval, "__embind_register_float": __embind_register_float, "__embind_register_integer": __embind_register_integer, "__embind_register_memory_view": __embind_register_memory_view, "__embind_register_std_string": __embind_register_std_string, "__embind_register_std_wstring": __embind_register_std_wstring, "__embind_register_void": __embind_register_void, "__emval_decref": __emval_decref, "__emval_register": __emval_register, "_abort": _abort, "_embind_repr": _embind_repr, "_emscripten_asm_const_id": _emscripten_asm_const_id, "_emscripten_asm_const_idi": _emscripten_asm_const_idi, "_emscripten_asm_const_ii": _emscripten_asm_const_ii, "_emscripten_memcpy_big": _emscripten_memcpy_big, "_llvm_cos_f64": _llvm_cos_f64, "_llvm_fabs_f64": _llvm_fabs_f64, "_llvm_log_f64": _llvm_log_f64, "_llvm_sin_f64": _llvm_sin_f64, "_llvm_sqrt_f32": _llvm_sqrt_f32, "_llvm_sqrt_f64": _llvm_sqrt_f64, "constNoSmartPtrRawPointerToWireType": constNoSmartPtrRawPointerToWireType, "count_emval_handles": count_emval_handles, "craftInvokerFunction": craftInvokerFunction, "createNamedFunction": createNamedFunction, "downcastPointer": downcastPointer, "embind__requireFunction": embind__requireFunction, "embind_init_charCodes": embind_init_charCodes, "ensureOverloadTable": ensureOverloadTable, "exposePublicSymbol": exposePublicSymbol, "extendError": extendError, "floatReadValueFromPointer": floatReadValueFromPointer, "flushPendingDeletes": flushPendingDeletes, "flush_NO_FILESYSTEM": flush_NO_FILESYSTEM, "genericPointerToWireType": genericPointerToWireType, "getBasestPointer": getBasestPointer, "getInheritedInstance": getInheritedInstance, "getInheritedInstanceCount": getInheritedInstanceCount, "getLiveInheritedInstances": getLiveInheritedInstances, "getShiftFromSize": getShiftFromSize, "getTypeName": getTypeName, "get_first_emval": get_first_emval, "heap32VectorToArray": heap32VectorToArray, "init_ClassHandle": init_ClassHandle, "init_RegisteredPointer": init_RegisteredPointer, "init_embind": init_embind, "init_emval": init_emval, "integerReadValueFromPointer": integerReadValueFromPointer, "makeClassHandle": makeClassHandle, "makeLegalFunctionName": makeLegalFunctionName, "new_": new_, "nonConstNoSmartPtrRawPointerToWireType": nonConstNoSmartPtrRawPointerToWireType, "readLatin1String": readLatin1String, "registerType": registerType, "replacePublicSymbol": replacePublicSymbol, "runDestructor": runDestructor, "runDestructors": runDestructors, "setDelayFunction": setDelayFunction, "shallowCopyInternalPointer": shallowCopyInternalPointer, "simpleReadValueFromPointer": simpleReadValueFromPointer, "throwBindingError": throwBindingError, "throwInstanceAlreadyDeleted": throwInstanceAlreadyDeleted, "throwInternalError": throwInternalError, "throwUnboundTypeError": throwUnboundTypeError, "upcastPointer": upcastPointer, "whenDependentTypesAreResolved": whenDependentTypesAreResolved, "DYNAMICTOP_PTR": DYNAMICTOP_PTR, "tempDoublePtr": tempDoublePtr, "ABORT": ABORT, "STACKTOP": STACKTOP, "STACK_MAX": STACK_MAX };
// EMSCRIPTEN_START_ASM
var asm = (/** @suppress {uselessCode} */ function(global, env, buffer) {
'almost asm';


  var HEAP8 = new global.Int8Array(buffer);
  var HEAP16 = new global.Int16Array(buffer);
  var HEAP32 = new global.Int32Array(buffer);
  var HEAPU8 = new global.Uint8Array(buffer);
  var HEAPU16 = new global.Uint16Array(buffer);
  var HEAPU32 = new global.Uint32Array(buffer);
  var HEAPF32 = new global.Float32Array(buffer);
  var HEAPF64 = new global.Float64Array(buffer);

  var DYNAMICTOP_PTR=env.DYNAMICTOP_PTR|0;
  var tempDoublePtr=env.tempDoublePtr|0;
  var ABORT=env.ABORT|0;
  var STACKTOP=env.STACKTOP|0;
  var STACK_MAX=env.STACK_MAX|0;

  var __THREW__ = 0;
  var threwValue = 0;
  var setjmpId = 0;
  var undef = 0;
  var nan = global.NaN, inf = global.Infinity;
  var tempInt = 0, tempBigInt = 0, tempBigIntS = 0, tempValue = 0, tempDouble = 0.0;
  var tempRet0 = 0;

  var Math_floor=global.Math.floor;
  var Math_abs=global.Math.abs;
  var Math_sqrt=global.Math.sqrt;
  var Math_pow=global.Math.pow;
  var Math_cos=global.Math.cos;
  var Math_sin=global.Math.sin;
  var Math_tan=global.Math.tan;
  var Math_acos=global.Math.acos;
  var Math_asin=global.Math.asin;
  var Math_atan=global.Math.atan;
  var Math_atan2=global.Math.atan2;
  var Math_exp=global.Math.exp;
  var Math_log=global.Math.log;
  var Math_ceil=global.Math.ceil;
  var Math_imul=global.Math.imul;
  var Math_min=global.Math.min;
  var Math_max=global.Math.max;
  var Math_clz32=global.Math.clz32;
  var abort=env.abort;
  var assert=env.assert;
  var enlargeMemory=env.enlargeMemory;
  var getTotalMemory=env.getTotalMemory;
  var abortOnCannotGrowMemory=env.abortOnCannotGrowMemory;
  var abortStackOverflow=env.abortStackOverflow;
  var nullFunc_i=env.nullFunc_i;
  var nullFunc_ii=env.nullFunc_ii;
  var nullFunc_iidiidddddddd=env.nullFunc_iidiidddddddd;
  var nullFunc_iiidiidddddddd=env.nullFunc_iiidiidddddddd;
  var nullFunc_iiii=env.nullFunc_iiii;
  var nullFunc_v=env.nullFunc_v;
  var nullFunc_vi=env.nullFunc_vi;
  var nullFunc_vii=env.nullFunc_vii;
  var nullFunc_viid=env.nullFunc_viid;
  var nullFunc_viiid=env.nullFunc_viiid;
  var nullFunc_viiii=env.nullFunc_viiii;
  var nullFunc_viiiii=env.nullFunc_viiiii;
  var nullFunc_viiiiii=env.nullFunc_viiiiii;
  var invoke_i=env.invoke_i;
  var invoke_ii=env.invoke_ii;
  var invoke_iidiidddddddd=env.invoke_iidiidddddddd;
  var invoke_iiidiidddddddd=env.invoke_iiidiidddddddd;
  var invoke_iiii=env.invoke_iiii;
  var invoke_v=env.invoke_v;
  var invoke_vi=env.invoke_vi;
  var invoke_vii=env.invoke_vii;
  var invoke_viid=env.invoke_viid;
  var invoke_viiid=env.invoke_viiid;
  var invoke_viiii=env.invoke_viiii;
  var invoke_viiiii=env.invoke_viiiii;
  var invoke_viiiiii=env.invoke_viiiiii;
  var ClassHandle=env.ClassHandle;
  var ClassHandle_clone=env.ClassHandle_clone;
  var ClassHandle_delete=env.ClassHandle_delete;
  var ClassHandle_deleteLater=env.ClassHandle_deleteLater;
  var ClassHandle_isAliasOf=env.ClassHandle_isAliasOf;
  var ClassHandle_isDeleted=env.ClassHandle_isDeleted;
  var RegisteredClass=env.RegisteredClass;
  var RegisteredPointer=env.RegisteredPointer;
  var RegisteredPointer_deleteObject=env.RegisteredPointer_deleteObject;
  var RegisteredPointer_destructor=env.RegisteredPointer_destructor;
  var RegisteredPointer_fromWireType=env.RegisteredPointer_fromWireType;
  var RegisteredPointer_getPointee=env.RegisteredPointer_getPointee;
  var __ZSt18uncaught_exceptionv=env.__ZSt18uncaught_exceptionv;
  var ___cxa_find_matching_catch=env.___cxa_find_matching_catch;
  var ___gxx_personality_v0=env.___gxx_personality_v0;
  var ___lock=env.___lock;
  var ___resumeException=env.___resumeException;
  var ___setErrNo=env.___setErrNo;
  var ___syscall140=env.___syscall140;
  var ___syscall146=env.___syscall146;
  var ___syscall54=env.___syscall54;
  var ___syscall6=env.___syscall6;
  var ___unlock=env.___unlock;
  var __embind_register_bool=env.__embind_register_bool;
  var __embind_register_class=env.__embind_register_class;
  var __embind_register_class_constructor=env.__embind_register_class_constructor;
  var __embind_register_class_function=env.__embind_register_class_function;
  var __embind_register_emval=env.__embind_register_emval;
  var __embind_register_float=env.__embind_register_float;
  var __embind_register_integer=env.__embind_register_integer;
  var __embind_register_memory_view=env.__embind_register_memory_view;
  var __embind_register_std_string=env.__embind_register_std_string;
  var __embind_register_std_wstring=env.__embind_register_std_wstring;
  var __embind_register_void=env.__embind_register_void;
  var __emval_decref=env.__emval_decref;
  var __emval_register=env.__emval_register;
  var _abort=env._abort;
  var _embind_repr=env._embind_repr;
  var _emscripten_asm_const_id=env._emscripten_asm_const_id;
  var _emscripten_asm_const_idi=env._emscripten_asm_const_idi;
  var _emscripten_asm_const_ii=env._emscripten_asm_const_ii;
  var _emscripten_memcpy_big=env._emscripten_memcpy_big;
  var _llvm_cos_f64=env._llvm_cos_f64;
  var _llvm_fabs_f64=env._llvm_fabs_f64;
  var _llvm_log_f64=env._llvm_log_f64;
  var _llvm_sin_f64=env._llvm_sin_f64;
  var _llvm_sqrt_f32=env._llvm_sqrt_f32;
  var _llvm_sqrt_f64=env._llvm_sqrt_f64;
  var constNoSmartPtrRawPointerToWireType=env.constNoSmartPtrRawPointerToWireType;
  var count_emval_handles=env.count_emval_handles;
  var craftInvokerFunction=env.craftInvokerFunction;
  var createNamedFunction=env.createNamedFunction;
  var downcastPointer=env.downcastPointer;
  var embind__requireFunction=env.embind__requireFunction;
  var embind_init_charCodes=env.embind_init_charCodes;
  var ensureOverloadTable=env.ensureOverloadTable;
  var exposePublicSymbol=env.exposePublicSymbol;
  var extendError=env.extendError;
  var floatReadValueFromPointer=env.floatReadValueFromPointer;
  var flushPendingDeletes=env.flushPendingDeletes;
  var flush_NO_FILESYSTEM=env.flush_NO_FILESYSTEM;
  var genericPointerToWireType=env.genericPointerToWireType;
  var getBasestPointer=env.getBasestPointer;
  var getInheritedInstance=env.getInheritedInstance;
  var getInheritedInstanceCount=env.getInheritedInstanceCount;
  var getLiveInheritedInstances=env.getLiveInheritedInstances;
  var getShiftFromSize=env.getShiftFromSize;
  var getTypeName=env.getTypeName;
  var get_first_emval=env.get_first_emval;
  var heap32VectorToArray=env.heap32VectorToArray;
  var init_ClassHandle=env.init_ClassHandle;
  var init_RegisteredPointer=env.init_RegisteredPointer;
  var init_embind=env.init_embind;
  var init_emval=env.init_emval;
  var integerReadValueFromPointer=env.integerReadValueFromPointer;
  var makeClassHandle=env.makeClassHandle;
  var makeLegalFunctionName=env.makeLegalFunctionName;
  var new_=env.new_;
  var nonConstNoSmartPtrRawPointerToWireType=env.nonConstNoSmartPtrRawPointerToWireType;
  var readLatin1String=env.readLatin1String;
  var registerType=env.registerType;
  var replacePublicSymbol=env.replacePublicSymbol;
  var runDestructor=env.runDestructor;
  var runDestructors=env.runDestructors;
  var setDelayFunction=env.setDelayFunction;
  var shallowCopyInternalPointer=env.shallowCopyInternalPointer;
  var simpleReadValueFromPointer=env.simpleReadValueFromPointer;
  var throwBindingError=env.throwBindingError;
  var throwInstanceAlreadyDeleted=env.throwInstanceAlreadyDeleted;
  var throwInternalError=env.throwInternalError;
  var throwUnboundTypeError=env.throwUnboundTypeError;
  var upcastPointer=env.upcastPointer;
  var whenDependentTypesAreResolved=env.whenDependentTypesAreResolved;
  var tempFloat = 0.0;

// EMSCRIPTEN_START_FUNCS

function stackAlloc(size) {
  size = size|0;
  var ret = 0;
  ret = STACKTOP;
  STACKTOP = (STACKTOP + size)|0;
  STACKTOP = (STACKTOP + 15)&-16;
  if ((STACKTOP|0) >= (STACK_MAX|0)) abortStackOverflow(size|0);

  return ret|0;
}
function stackSave() {
  return STACKTOP|0;
}
function stackRestore(top) {
  top = top|0;
  STACKTOP = top;
}
function establishStackSpace(stackBase, stackMax) {
  stackBase = stackBase|0;
  stackMax = stackMax|0;
  STACKTOP = stackBase;
  STACK_MAX = stackMax;
}

function setThrew(threw, value) {
  threw = threw|0;
  value = value|0;
  if ((__THREW__|0) == 0) {
    __THREW__ = threw;
    threwValue = value;
  }
}

function setTempRet0(value) {
  value = value|0;
  tempRet0 = value;
}
function getTempRet0() {
  return tempRet0|0;
}

function ___cxx_global_var_init() {
 var label = 0, sp = 0;
 sp = STACKTOP;
 __ZN39EmscriptenBindingInitializer_nstrumentaC2Ev(4828); //@line 195 "nstrumenta.cpp"
 return; //@line 195 "nstrumenta.cpp"
}
function __ZN39EmscriptenBindingInitializer_nstrumentaC2Ev($0) {
 $0 = $0|0;
 var $$field = 0, $$field11 = 0, $$field14 = 0, $$field21 = 0, $$field24 = 0, $$field4 = 0, $$index1 = 0, $$index13 = 0, $$index17 = 0, $$index19 = 0, $$index23 = 0, $$index27 = 0, $$index3 = 0, $$index7 = 0, $$index9 = 0, $1 = 0, $10 = 0, $11 = 0, $12 = 0, $13 = 0;
 var $14 = 0, $15 = 0, $16 = 0, $17 = 0, $18 = 0, $19 = 0, $2 = 0, $20 = 0, $21 = 0, $22 = 0, $23 = 0, $24 = 0, $25 = 0, $26 = 0, $27 = 0, $28 = 0, $29 = 0, $3 = 0, $30 = 0, $31 = 0;
 var $32 = 0, $33 = 0, $34 = 0, $35 = 0, $36 = 0, $37 = 0, $38 = 0, $39 = 0, $4 = 0, $40 = 0, $41 = 0, $42 = 0, $43 = 0, $44 = 0, $45 = 0, $46 = 0, $47 = 0, $48 = 0, $49 = 0, $5 = 0;
 var $50 = 0, $51 = 0, $52 = 0, $53 = 0, $54 = 0, $55 = 0, $56 = 0, $57 = 0, $58 = 0, $59 = 0, $6 = 0, $60 = 0, $61 = 0, $62 = 0, $63 = 0, $64 = 0, $65 = 0, $66 = 0, $67 = 0, $68 = 0;
 var $69 = 0, $7 = 0, $70 = 0, $71 = 0, $72 = 0, $73 = 0, $74 = 0, $75 = 0, $76 = 0, $77 = 0, $78 = 0, $79 = 0, $8 = 0, $80 = 0, $81 = 0, $82 = 0, $83 = 0, $84 = 0, $85 = 0, $86 = 0;
 var $87 = 0, $88 = 0, $89 = 0, $9 = 0, $90 = 0, $91 = 0, $92 = 0, $93 = 0, $94 = 0, $95 = 0, $96 = 0, label = 0, sp = 0;
 sp = STACKTOP;
 STACKTOP = STACKTOP + 208|0; if ((STACKTOP|0) >= (STACK_MAX|0)) abortStackOverflow(208|0);
 $4 = sp + 168|0;
 $6 = sp + 192|0;
 $7 = sp + 16|0;
 $11 = sp + 144|0;
 $13 = sp + 191|0;
 $14 = sp + 8|0;
 $18 = sp + 120|0;
 $20 = sp + 190|0;
 $21 = sp;
 $25 = sp + 189|0;
 $39 = sp + 188|0;
 $40 = sp + 40|0;
 $41 = sp + 32|0;
 $42 = sp + 24|0;
 $38 = $0;
 $32 = $39;
 $33 = 864;
 __ZN10emscripten8internal11NoBaseClass6verifyI10NstrumentaEEvv(); //@line 1121 "/emsdk_portable/sdk/system/include/emscripten/bind.h"
 $34 = 24; //@line 1123 "/emsdk_portable/sdk/system/include/emscripten/bind.h"
 $43 = (__ZN10emscripten8internal11NoBaseClass11getUpcasterI10NstrumentaEEPFvvEv()|0); //@line 1124 "/emsdk_portable/sdk/system/include/emscripten/bind.h"
 $35 = $43; //@line 1124 "/emsdk_portable/sdk/system/include/emscripten/bind.h"
 $44 = (__ZN10emscripten8internal11NoBaseClass13getDowncasterI10NstrumentaEEPFvvEv()|0); //@line 1125 "/emsdk_portable/sdk/system/include/emscripten/bind.h"
 $36 = $44; //@line 1125 "/emsdk_portable/sdk/system/include/emscripten/bind.h"
 $37 = 25; //@line 1126 "/emsdk_portable/sdk/system/include/emscripten/bind.h"
 $45 = (__ZN10emscripten8internal6TypeIDI10NstrumentaE3getEv()|0); //@line 1129 "/emsdk_portable/sdk/system/include/emscripten/bind.h"
 $46 = (__ZN10emscripten8internal6TypeIDINS0_17AllowedRawPointerI10NstrumentaEEE3getEv()|0); //@line 1130 "/emsdk_portable/sdk/system/include/emscripten/bind.h"
 $47 = (__ZN10emscripten8internal6TypeIDINS0_17AllowedRawPointerIK10NstrumentaEEE3getEv()|0); //@line 1131 "/emsdk_portable/sdk/system/include/emscripten/bind.h"
 $48 = (__ZN10emscripten8internal11NoBaseClass3getEv()|0); //@line 1132 "/emsdk_portable/sdk/system/include/emscripten/bind.h"
 $49 = $34; //@line 1133 "/emsdk_portable/sdk/system/include/emscripten/bind.h"
 $31 = $49;
 $50 = (__ZN10emscripten8internal19getGenericSignatureIJiiEEEPKcv()|0); //@line 399 "/emsdk_portable/sdk/system/include/emscripten/bind.h"
 $51 = $34; //@line 1134 "/emsdk_portable/sdk/system/include/emscripten/bind.h"
 $52 = $35; //@line 1135 "/emsdk_portable/sdk/system/include/emscripten/bind.h"
 $30 = $52;
 $53 = (__ZN10emscripten8internal19getGenericSignatureIJvEEEPKcv()|0); //@line 399 "/emsdk_portable/sdk/system/include/emscripten/bind.h"
 $54 = $35; //@line 1136 "/emsdk_portable/sdk/system/include/emscripten/bind.h"
 $55 = $36; //@line 1137 "/emsdk_portable/sdk/system/include/emscripten/bind.h"
 $29 = $55;
 $56 = (__ZN10emscripten8internal19getGenericSignatureIJvEEEPKcv()|0); //@line 399 "/emsdk_portable/sdk/system/include/emscripten/bind.h"
 $57 = $36; //@line 1138 "/emsdk_portable/sdk/system/include/emscripten/bind.h"
 $58 = $33; //@line 1139 "/emsdk_portable/sdk/system/include/emscripten/bind.h"
 $59 = $37; //@line 1140 "/emsdk_portable/sdk/system/include/emscripten/bind.h"
 $28 = $59;
 $60 = (__ZN10emscripten8internal19getGenericSignatureIJviEEEPKcv()|0); //@line 399 "/emsdk_portable/sdk/system/include/emscripten/bind.h"
 $61 = $37; //@line 1141 "/emsdk_portable/sdk/system/include/emscripten/bind.h"
 __embind_register_class(($45|0),($46|0),($47|0),($48|0),($50|0),($51|0),($53|0),($54|0),($56|0),($57|0),($58|0),($60|0),($61|0)); //@line 1128 "/emsdk_portable/sdk/system/include/emscripten/bind.h"
 $27 = $39;
 $62 = $27;
 $23 = $62;
 $24 = 26;
 $63 = $23;
 $26 = 27; //@line 1187 "/emsdk_portable/sdk/system/include/emscripten/bind.h"
 $64 = (__ZN10emscripten8internal6TypeIDI10NstrumentaE3getEv()|0); //@line 1189 "/emsdk_portable/sdk/system/include/emscripten/bind.h"
 $65 = (__ZNK10emscripten8internal12WithPoliciesIJNS_18allow_raw_pointersEEE11ArgTypeListIJP10NstrumentaEE8getCountEv($25)|0); //@line 1190 "/emsdk_portable/sdk/system/include/emscripten/bind.h"
 $66 = (__ZNK10emscripten8internal12WithPoliciesIJNS_18allow_raw_pointersEEE11ArgTypeListIJP10NstrumentaEE8getTypesEv($25)|0); //@line 1191 "/emsdk_portable/sdk/system/include/emscripten/bind.h"
 $67 = $26; //@line 1192 "/emsdk_portable/sdk/system/include/emscripten/bind.h"
 $22 = $67;
 $68 = (__ZN10emscripten8internal19getGenericSignatureIJiiEEEPKcv()|0); //@line 399 "/emsdk_portable/sdk/system/include/emscripten/bind.h"
 $69 = $26; //@line 1193 "/emsdk_portable/sdk/system/include/emscripten/bind.h"
 $70 = $24; //@line 1194 "/emsdk_portable/sdk/system/include/emscripten/bind.h"
 __embind_register_class_constructor(($64|0),($65|0),($66|0),($68|0),($69|0),($70|0)); //@line 1188 "/emsdk_portable/sdk/system/include/emscripten/bind.h"
 HEAP32[$40>>2] = (28); //@line 199 "nstrumenta.cpp"
 $$index1 = ((($40)) + 4|0); //@line 199 "nstrumenta.cpp"
 HEAP32[$$index1>>2] = 0; //@line 199 "nstrumenta.cpp"
 ;HEAP8[$21>>0]=HEAP8[$40>>0]|0;HEAP8[$21+1>>0]=HEAP8[$40+1>>0]|0;HEAP8[$21+2>>0]=HEAP8[$40+2>>0]|0;HEAP8[$21+3>>0]=HEAP8[$40+3>>0]|0;HEAP8[$21+4>>0]=HEAP8[$40+4>>0]|0;HEAP8[$21+5>>0]=HEAP8[$40+5>>0]|0;HEAP8[$21+6>>0]=HEAP8[$40+6>>0]|0;HEAP8[$21+7>>0]=HEAP8[$40+7>>0]|0;
 $$field = HEAP32[$21>>2]|0;
 $$index3 = ((($21)) + 4|0);
 $$field4 = HEAP32[$$index3>>2]|0;
 $16 = $63;
 $17 = 875;
 HEAP32[$18>>2] = $$field;
 $$index7 = ((($18)) + 4|0);
 HEAP32[$$index7>>2] = $$field4;
 $71 = $16;
 $19 = 29; //@line 1270 "/emsdk_portable/sdk/system/include/emscripten/bind.h"
 $72 = (__ZN10emscripten8internal6TypeIDI10NstrumentaE3getEv()|0); //@line 1274 "/emsdk_portable/sdk/system/include/emscripten/bind.h"
 $73 = $17; //@line 1275 "/emsdk_portable/sdk/system/include/emscripten/bind.h"
 $74 = (__ZNK10emscripten8internal12WithPoliciesIJEE11ArgTypeListIJvNS0_17AllowedRawPointerI10NstrumentaEEEE8getCountEv($20)|0); //@line 1276 "/emsdk_portable/sdk/system/include/emscripten/bind.h"
 $75 = (__ZNK10emscripten8internal12WithPoliciesIJEE11ArgTypeListIJvNS0_17AllowedRawPointerI10NstrumentaEEEE8getTypesEv($20)|0); //@line 1277 "/emsdk_portable/sdk/system/include/emscripten/bind.h"
 $76 = $19; //@line 1278 "/emsdk_portable/sdk/system/include/emscripten/bind.h"
 $15 = $76;
 $77 = (__ZN10emscripten8internal19getGenericSignatureIJviiEEEPKcv()|0); //@line 399 "/emsdk_portable/sdk/system/include/emscripten/bind.h"
 $78 = $19; //@line 1279 "/emsdk_portable/sdk/system/include/emscripten/bind.h"
 $79 = (__ZN10emscripten8internal10getContextIM10NstrumentaFvvEEEPT_RKS5_($18)|0); //@line 1280 "/emsdk_portable/sdk/system/include/emscripten/bind.h"
 __embind_register_class_function(($72|0),($73|0),($74|0),($75|0),($77|0),($78|0),($79|0),0); //@line 1273 "/emsdk_portable/sdk/system/include/emscripten/bind.h"
 HEAP32[$41>>2] = (30); //@line 200 "nstrumenta.cpp"
 $$index9 = ((($41)) + 4|0); //@line 200 "nstrumenta.cpp"
 HEAP32[$$index9>>2] = 0; //@line 200 "nstrumenta.cpp"
 ;HEAP8[$14>>0]=HEAP8[$41>>0]|0;HEAP8[$14+1>>0]=HEAP8[$41+1>>0]|0;HEAP8[$14+2>>0]=HEAP8[$41+2>>0]|0;HEAP8[$14+3>>0]=HEAP8[$41+3>>0]|0;HEAP8[$14+4>>0]=HEAP8[$41+4>>0]|0;HEAP8[$14+5>>0]=HEAP8[$41+5>>0]|0;HEAP8[$14+6>>0]=HEAP8[$41+6>>0]|0;HEAP8[$14+7>>0]=HEAP8[$41+7>>0]|0;
 $$field11 = HEAP32[$14>>2]|0;
 $$index13 = ((($14)) + 4|0);
 $$field14 = HEAP32[$$index13>>2]|0;
 $9 = $71;
 $10 = 880;
 HEAP32[$11>>2] = $$field11;
 $$index17 = ((($11)) + 4|0);
 HEAP32[$$index17>>2] = $$field14;
 $80 = $9;
 $12 = 31; //@line 1270 "/emsdk_portable/sdk/system/include/emscripten/bind.h"
 $81 = (__ZN10emscripten8internal6TypeIDI10NstrumentaE3getEv()|0); //@line 1274 "/emsdk_portable/sdk/system/include/emscripten/bind.h"
 $82 = $10; //@line 1275 "/emsdk_portable/sdk/system/include/emscripten/bind.h"
 $83 = (__ZNK10emscripten8internal12WithPoliciesIJEE11ArgTypeListIJvNS0_17AllowedRawPointerI10NstrumentaEEidEE8getCountEv($13)|0); //@line 1276 "/emsdk_portable/sdk/system/include/emscripten/bind.h"
 $84 = (__ZNK10emscripten8internal12WithPoliciesIJEE11ArgTypeListIJvNS0_17AllowedRawPointerI10NstrumentaEEidEE8getTypesEv($13)|0); //@line 1277 "/emsdk_portable/sdk/system/include/emscripten/bind.h"
 $85 = $12; //@line 1278 "/emsdk_portable/sdk/system/include/emscripten/bind.h"
 $8 = $85;
 $86 = (__ZN10emscripten8internal19getGenericSignatureIJviiidEEEPKcv()|0); //@line 399 "/emsdk_portable/sdk/system/include/emscripten/bind.h"
 $87 = $12; //@line 1279 "/emsdk_portable/sdk/system/include/emscripten/bind.h"
 $88 = (__ZN10emscripten8internal10getContextIM10NstrumentaFvidEEEPT_RKS5_($11)|0); //@line 1280 "/emsdk_portable/sdk/system/include/emscripten/bind.h"
 __embind_register_class_function(($81|0),($82|0),($83|0),($84|0),($86|0),($87|0),($88|0),0); //@line 1273 "/emsdk_portable/sdk/system/include/emscripten/bind.h"
 HEAP32[$42>>2] = (32); //@line 201 "nstrumenta.cpp"
 $$index19 = ((($42)) + 4|0); //@line 201 "nstrumenta.cpp"
 HEAP32[$$index19>>2] = 0; //@line 201 "nstrumenta.cpp"
 ;HEAP8[$7>>0]=HEAP8[$42>>0]|0;HEAP8[$7+1>>0]=HEAP8[$42+1>>0]|0;HEAP8[$7+2>>0]=HEAP8[$42+2>>0]|0;HEAP8[$7+3>>0]=HEAP8[$42+3>>0]|0;HEAP8[$7+4>>0]=HEAP8[$42+4>>0]|0;HEAP8[$7+5>>0]=HEAP8[$42+5>>0]|0;HEAP8[$7+6>>0]=HEAP8[$42+6>>0]|0;HEAP8[$7+7>>0]=HEAP8[$42+7>>0]|0;
 $$field21 = HEAP32[$7>>2]|0;
 $$index23 = ((($7)) + 4|0);
 $$field24 = HEAP32[$$index23>>2]|0;
 $2 = $80;
 $3 = 893;
 HEAP32[$4>>2] = $$field21;
 $$index27 = ((($4)) + 4|0);
 HEAP32[$$index27>>2] = $$field24;
 $5 = 33; //@line 1270 "/emsdk_portable/sdk/system/include/emscripten/bind.h"
 $89 = (__ZN10emscripten8internal6TypeIDI10NstrumentaE3getEv()|0); //@line 1274 "/emsdk_portable/sdk/system/include/emscripten/bind.h"
 $90 = $3; //@line 1275 "/emsdk_portable/sdk/system/include/emscripten/bind.h"
 $91 = (__ZNK10emscripten8internal12WithPoliciesIJEE11ArgTypeListIJiNS0_17AllowedRawPointerI10NstrumentaEEdjiddddddddEE8getCountEv($6)|0); //@line 1276 "/emsdk_portable/sdk/system/include/emscripten/bind.h"
 $92 = (__ZNK10emscripten8internal12WithPoliciesIJEE11ArgTypeListIJiNS0_17AllowedRawPointerI10NstrumentaEEdjiddddddddEE8getTypesEv($6)|0); //@line 1277 "/emsdk_portable/sdk/system/include/emscripten/bind.h"
 $93 = $5; //@line 1278 "/emsdk_portable/sdk/system/include/emscripten/bind.h"
 $1 = $93;
 $94 = (__ZN10emscripten8internal19getGenericSignatureIJiiidiiddddddddEEEPKcv()|0); //@line 399 "/emsdk_portable/sdk/system/include/emscripten/bind.h"
 $95 = $5; //@line 1279 "/emsdk_portable/sdk/system/include/emscripten/bind.h"
 $96 = (__ZN10emscripten8internal10getContextIM10NstrumentaFidjiddddddddEEEPT_RKS5_($4)|0); //@line 1280 "/emsdk_portable/sdk/system/include/emscripten/bind.h"
 __embind_register_class_function(($89|0),($90|0),($91|0),($92|0),($94|0),($95|0),($96|0),0); //@line 1273 "/emsdk_portable/sdk/system/include/emscripten/bind.h"
 STACKTOP = sp;return; //@line 202 "nstrumenta.cpp"
}
function __ZN10Nstrumenta4initEv($0) {
 $0 = $0|0;
 var $1 = 0, label = 0, sp = 0;
 sp = STACKTOP;
 STACKTOP = STACKTOP + 16|0; if ((STACKTOP|0) >= (STACK_MAX|0)) abortStackOverflow(16|0);
 $1 = $0;
 _algorithm_init(); //@line 18 "nstrumenta.cpp"
 STACKTOP = sp;return; //@line 19 "nstrumenta.cpp"
}
function __ZN10Nstrumenta12setParameterEid($0,$1,$2) {
 $0 = $0|0;
 $1 = $1|0;
 $2 = +$2;
 var $10 = 0.0, $11 = 0.0, $12 = 0.0, $13 = 0.0, $14 = 0.0, $15 = 0.0, $16 = 0.0, $17 = 0.0, $18 = 0.0, $19 = 0.0, $20 = 0.0, $21 = 0.0, $22 = 0.0, $23 = 0.0, $24 = 0.0, $25 = 0.0, $26 = 0.0, $27 = 0.0, $28 = 0.0, $29 = 0.0;
 var $3 = 0, $30 = 0.0, $31 = 0.0, $32 = 0.0, $33 = 0.0, $34 = 0.0, $35 = 0.0, $36 = 0.0, $37 = 0.0, $38 = 0.0, $39 = 0.0, $4 = 0, $40 = 0.0, $41 = 0.0, $42 = 0.0, $43 = 0.0, $44 = 0.0, $45 = 0.0, $5 = 0.0, $6 = 0;
 var $7 = 0.0, $8 = 0.0, $9 = 0.0, label = 0, sp = 0;
 sp = STACKTOP;
 STACKTOP = STACKTOP + 16|0; if ((STACKTOP|0) >= (STACK_MAX|0)) abortStackOverflow(16|0);
 $3 = $0;
 $4 = $1;
 $5 = $2;
 $6 = $4; //@line 23 "nstrumenta.cpp"
 do {
  switch ($6|0) {
  case 0:  {
   $7 = $5; //@line 28 "nstrumenta.cpp"
   HEAPF64[(4096)>>3] = $7; //@line 28 "nstrumenta.cpp"
   break;
  }
  case 1:  {
   $8 = $5; //@line 33 "nstrumenta.cpp"
   HEAPF64[(4088)>>3] = $8; //@line 33 "nstrumenta.cpp"
   break;
  }
  case 2:  {
   $9 = $5; //@line 38 "nstrumenta.cpp"
   HEAPF64[(4144)>>3] = $9; //@line 38 "nstrumenta.cpp"
   break;
  }
  case 3:  {
   $10 = $5; //@line 43 "nstrumenta.cpp"
   $11 = $10; //@line 43 "nstrumenta.cpp"
   HEAPF32[(4104)>>2] = $11; //@line 43 "nstrumenta.cpp"
   break;
  }
  case 4:  {
   $12 = $5; //@line 48 "nstrumenta.cpp"
   $13 = $12; //@line 48 "nstrumenta.cpp"
   HEAPF32[(4108)>>2] = $13; //@line 48 "nstrumenta.cpp"
   break;
  }
  case 5:  {
   $14 = $5; //@line 53 "nstrumenta.cpp"
   $15 = $14; //@line 53 "nstrumenta.cpp"
   HEAPF32[(4112)>>2] = $15; //@line 53 "nstrumenta.cpp"
   break;
  }
  case 6:  {
   $16 = $5; //@line 58 "nstrumenta.cpp"
   $17 = $16; //@line 58 "nstrumenta.cpp"
   HEAPF32[(4116)>>2] = $17; //@line 58 "nstrumenta.cpp"
   break;
  }
  case 7:  {
   $18 = $5; //@line 63 "nstrumenta.cpp"
   $19 = $18; //@line 63 "nstrumenta.cpp"
   HEAPF32[(4120)>>2] = $19; //@line 63 "nstrumenta.cpp"
   break;
  }
  case 8:  {
   $20 = $5; //@line 68 "nstrumenta.cpp"
   $21 = $20; //@line 68 "nstrumenta.cpp"
   HEAPF32[(4124)>>2] = $21; //@line 68 "nstrumenta.cpp"
   break;
  }
  case 9:  {
   $22 = $5; //@line 73 "nstrumenta.cpp"
   $23 = $22; //@line 73 "nstrumenta.cpp"
   HEAPF32[(4128)>>2] = $23; //@line 73 "nstrumenta.cpp"
   break;
  }
  case 10:  {
   $24 = $5; //@line 78 "nstrumenta.cpp"
   $25 = $24; //@line 78 "nstrumenta.cpp"
   HEAPF32[(4132)>>2] = $25; //@line 78 "nstrumenta.cpp"
   break;
  }
  case 11:  {
   $26 = $5; //@line 83 "nstrumenta.cpp"
   $27 = $26; //@line 83 "nstrumenta.cpp"
   HEAPF32[(4136)>>2] = $27; //@line 83 "nstrumenta.cpp"
   break;
  }
  case 12:  {
   $28 = $5; //@line 88 "nstrumenta.cpp"
   $29 = $28; //@line 88 "nstrumenta.cpp"
   HEAPF32[(4152)>>2] = $29; //@line 88 "nstrumenta.cpp"
   break;
  }
  case 13:  {
   $30 = $5; //@line 93 "nstrumenta.cpp"
   $31 = $30; //@line 93 "nstrumenta.cpp"
   HEAPF32[(4156)>>2] = $31; //@line 93 "nstrumenta.cpp"
   break;
  }
  case 14:  {
   $32 = $5; //@line 98 "nstrumenta.cpp"
   $33 = $32; //@line 98 "nstrumenta.cpp"
   HEAPF32[(4160)>>2] = $33; //@line 98 "nstrumenta.cpp"
   break;
  }
  case 15:  {
   $34 = $5; //@line 103 "nstrumenta.cpp"
   $35 = $34; //@line 103 "nstrumenta.cpp"
   HEAPF32[(4164)>>2] = $35; //@line 103 "nstrumenta.cpp"
   break;
  }
  case 16:  {
   $36 = $5; //@line 108 "nstrumenta.cpp"
   $37 = $36; //@line 108 "nstrumenta.cpp"
   HEAPF32[(4168)>>2] = $37; //@line 108 "nstrumenta.cpp"
   break;
  }
  case 17:  {
   $38 = $5; //@line 113 "nstrumenta.cpp"
   $39 = $38; //@line 113 "nstrumenta.cpp"
   HEAPF32[(4172)>>2] = $39; //@line 113 "nstrumenta.cpp"
   break;
  }
  case 18:  {
   $40 = $5; //@line 118 "nstrumenta.cpp"
   $41 = $40; //@line 118 "nstrumenta.cpp"
   HEAPF32[(4176)>>2] = $41; //@line 118 "nstrumenta.cpp"
   break;
  }
  case 19:  {
   $42 = $5; //@line 123 "nstrumenta.cpp"
   $43 = $42; //@line 123 "nstrumenta.cpp"
   HEAPF32[(4180)>>2] = $43; //@line 123 "nstrumenta.cpp"
   break;
  }
  case 20:  {
   $44 = $5; //@line 128 "nstrumenta.cpp"
   $45 = $44; //@line 128 "nstrumenta.cpp"
   HEAPF32[(4184)>>2] = $45; //@line 128 "nstrumenta.cpp"
   break;
  }
  default: {
  }
  }
 } while(0);
 STACKTOP = sp;return; //@line 132 "nstrumenta.cpp"
}
function __ZN10Nstrumenta11ReportEventEdjidddddddd($0,$1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11) {
 $0 = $0|0;
 $1 = +$1;
 $2 = $2|0;
 $3 = $3|0;
 $4 = +$4;
 $5 = +$5;
 $6 = +$6;
 $7 = +$7;
 $8 = +$8;
 $9 = +$9;
 $10 = +$10;
 $11 = +$11;
 var $$byval_copy = 0, $12 = 0, $13 = 0.0, $14 = 0, $15 = 0, $16 = 0.0, $17 = 0.0, $18 = 0.0, $19 = 0.0, $20 = 0.0, $21 = 0.0, $22 = 0.0, $23 = 0.0, $24 = 0, $25 = 0, $26 = 0, $27 = 0, $28 = 0, $29 = 0, $30 = 0.0;
 var $31 = 0, $32 = 0, $33 = 0.0, $34 = 0, $35 = 0.0, $36 = 0, $37 = 0, $38 = 0.0, $39 = 0, $40 = 0, $41 = 0.0, $42 = 0, $43 = 0, $44 = 0.0, $45 = 0, $46 = 0, $47 = 0.0, $48 = 0, $49 = 0, $50 = 0.0;
 var $51 = 0, $52 = 0, $53 = 0.0, $54 = 0, $55 = 0, $56 = 0, $57 = 0, $58 = 0, $59 = 0, $60 = 0, $61 = 0, $62 = 0, $63 = 0.0, $64 = 0, $65 = 0, $66 = 0, $67 = 0, $68 = 0, $69 = 0, $70 = 0;
 var $71 = 0, $72 = 0, $73 = 0, $74 = 0, $75 = 0, $76 = 0, $77 = 0, $78 = 0, $79 = 0, $80 = 0.0, $81 = 0, $82 = 0, $83 = 0, $84 = 0, $85 = 0, $86 = 0, label = 0, sp = 0;
 sp = STACKTOP;
 STACKTOP = STACKTOP + 2832|0; if ((STACKTOP|0) >= (STACK_MAX|0)) abortStackOverflow(2832|0);
 $$byval_copy = sp + 2664|0;
 $24 = sp + 2448|0;
 $25 = sp + 144|0;
 $26 = sp + 2816|0;
 $27 = sp;
 $12 = $0;
 $13 = $1;
 $14 = $2;
 $15 = $3;
 $16 = $4;
 $17 = $5;
 $18 = $6;
 $19 = $7;
 $20 = $8;
 $21 = $9;
 $22 = $10;
 $23 = $11;
 HEAP32[$26>>2] = 0; //@line 148 "nstrumenta.cpp"
 $30 = $13; //@line 150 "nstrumenta.cpp"
 HEAPF64[$24>>3] = $30; //@line 150 "nstrumenta.cpp"
 $31 = $14; //@line 151 "nstrumenta.cpp"
 $32 = ((($24)) + 8|0); //@line 151 "nstrumenta.cpp"
 HEAP32[$32>>2] = $31; //@line 151 "nstrumenta.cpp"
 $33 = $16; //@line 152 "nstrumenta.cpp"
 $34 = ((($24)) + 16|0); //@line 152 "nstrumenta.cpp"
 HEAPF64[$34>>3] = $33; //@line 152 "nstrumenta.cpp"
 $35 = $17; //@line 153 "nstrumenta.cpp"
 $36 = ((($24)) + 16|0); //@line 153 "nstrumenta.cpp"
 $37 = ((($36)) + 8|0); //@line 153 "nstrumenta.cpp"
 HEAPF64[$37>>3] = $35; //@line 153 "nstrumenta.cpp"
 $38 = $18; //@line 154 "nstrumenta.cpp"
 $39 = ((($24)) + 16|0); //@line 154 "nstrumenta.cpp"
 $40 = ((($39)) + 16|0); //@line 154 "nstrumenta.cpp"
 HEAPF64[$40>>3] = $38; //@line 154 "nstrumenta.cpp"
 $41 = $19; //@line 155 "nstrumenta.cpp"
 $42 = ((($24)) + 16|0); //@line 155 "nstrumenta.cpp"
 $43 = ((($42)) + 24|0); //@line 155 "nstrumenta.cpp"
 HEAPF64[$43>>3] = $41; //@line 155 "nstrumenta.cpp"
 $44 = $20; //@line 156 "nstrumenta.cpp"
 $45 = ((($24)) + 16|0); //@line 156 "nstrumenta.cpp"
 $46 = ((($45)) + 32|0); //@line 156 "nstrumenta.cpp"
 HEAPF64[$46>>3] = $44; //@line 156 "nstrumenta.cpp"
 $47 = $21; //@line 157 "nstrumenta.cpp"
 $48 = ((($24)) + 16|0); //@line 157 "nstrumenta.cpp"
 $49 = ((($48)) + 40|0); //@line 157 "nstrumenta.cpp"
 HEAPF64[$49>>3] = $47; //@line 157 "nstrumenta.cpp"
 $50 = $22; //@line 158 "nstrumenta.cpp"
 $51 = ((($24)) + 16|0); //@line 158 "nstrumenta.cpp"
 $52 = ((($51)) + 48|0); //@line 158 "nstrumenta.cpp"
 HEAPF64[$52>>3] = $50; //@line 158 "nstrumenta.cpp"
 $53 = $23; //@line 159 "nstrumenta.cpp"
 $54 = ((($24)) + 16|0); //@line 159 "nstrumenta.cpp"
 $55 = ((($54)) + 56|0); //@line 159 "nstrumenta.cpp"
 HEAPF64[$55>>3] = $53; //@line 159 "nstrumenta.cpp"
 _memcpy(($27|0),($24|0),144)|0; //@line 161 "nstrumenta.cpp"
 _memcpy(($$byval_copy|0),($27|0),144)|0; //@line 161 "nstrumenta.cpp"
 _algorithm_update($$byval_copy,$25,$26); //@line 161 "nstrumenta.cpp"
 $56 = HEAP32[$26>>2]|0; //@line 163 "nstrumenta.cpp"
 $57 = ($56|0)>(0); //@line 163 "nstrumenta.cpp"
 if (!($57)) {
  STACKTOP = sp;return 0; //@line 188 "nstrumenta.cpp"
 }
 $28 = 0; //@line 165 "nstrumenta.cpp"
 while(1) {
  $58 = $28; //@line 165 "nstrumenta.cpp"
  $59 = HEAP32[$26>>2]|0; //@line 165 "nstrumenta.cpp"
  $60 = ($58|0)<($59|0); //@line 165 "nstrumenta.cpp"
  if (!($60)) {
   break;
  }
  $61 = $28; //@line 167 "nstrumenta.cpp"
  $62 = (($25) + (($61*144)|0)|0); //@line 167 "nstrumenta.cpp"
  $63 = +HEAPF64[$62>>3]; //@line 167 "nstrumenta.cpp"
  $64 = $28; //@line 167 "nstrumenta.cpp"
  $65 = (($25) + (($64*144)|0)|0); //@line 167 "nstrumenta.cpp"
  $66 = ((($65)) + 8|0); //@line 167 "nstrumenta.cpp"
  $67 = HEAP32[$66>>2]|0; //@line 167 "nstrumenta.cpp"
  $68 = _emscripten_asm_const_idi(0,(+$63),($67|0))|0; //@line 167 "nstrumenta.cpp"
  $29 = 0; //@line 175 "nstrumenta.cpp"
  while(1) {
   $69 = $29; //@line 175 "nstrumenta.cpp"
   $70 = $28; //@line 175 "nstrumenta.cpp"
   $71 = (($25) + (($70*144)|0)|0); //@line 175 "nstrumenta.cpp"
   $72 = ((($71)) + 12|0); //@line 175 "nstrumenta.cpp"
   $73 = HEAP32[$72>>2]|0; //@line 175 "nstrumenta.cpp"
   $74 = ($69|0)<($73|0); //@line 175 "nstrumenta.cpp"
   if (!($74)) {
    break;
   }
   $75 = $28; //@line 177 "nstrumenta.cpp"
   $76 = (($25) + (($75*144)|0)|0); //@line 177 "nstrumenta.cpp"
   $77 = ((($76)) + 16|0); //@line 177 "nstrumenta.cpp"
   $78 = $29; //@line 177 "nstrumenta.cpp"
   $79 = (($77) + ($78<<3)|0); //@line 177 "nstrumenta.cpp"
   $80 = +HEAPF64[$79>>3]; //@line 177 "nstrumenta.cpp"
   $81 = _emscripten_asm_const_id(1,(+$80))|0; //@line 177 "nstrumenta.cpp"
   $82 = $29; //@line 175 "nstrumenta.cpp"
   $83 = (($82) + 1)|0; //@line 175 "nstrumenta.cpp"
   $29 = $83; //@line 175 "nstrumenta.cpp"
  }
  $84 = _emscripten_asm_const_ii(2,0)|0; //@line 182 "nstrumenta.cpp"
  $85 = $28; //@line 165 "nstrumenta.cpp"
  $86 = (($85) + 1)|0; //@line 165 "nstrumenta.cpp"
  $28 = $86; //@line 165 "nstrumenta.cpp"
 }
 STACKTOP = sp;return 0; //@line 188 "nstrumenta.cpp"
}
function __ZN10emscripten8internal11NoBaseClass6verifyI10NstrumentaEEvv() {
 var label = 0, sp = 0;
 sp = STACKTOP;
 return; //@line 1009 "/emsdk_portable/sdk/system/include/emscripten/bind.h"
}
function __ZN10emscripten8internal13getActualTypeI10NstrumentaEEPKvPT_($0) {
 $0 = $0|0;
 var $1 = 0, $2 = 0, $3 = 0, label = 0, sp = 0;
 sp = STACKTOP;
 STACKTOP = STACKTOP + 16|0; if ((STACKTOP|0) >= (STACK_MAX|0)) abortStackOverflow(16|0);
 $1 = $0;
 $2 = $1; //@line 1029 "/emsdk_portable/sdk/system/include/emscripten/bind.h"
 $3 = (__ZN10emscripten8internal14getLightTypeIDI10NstrumentaEEPKvRKT_($2)|0); //@line 1029 "/emsdk_portable/sdk/system/include/emscripten/bind.h"
 STACKTOP = sp;return ($3|0); //@line 1029 "/emsdk_portable/sdk/system/include/emscripten/bind.h"
}
function __ZN10emscripten8internal11NoBaseClass11getUpcasterI10NstrumentaEEPFvvEv() {
 var label = 0, sp = 0;
 sp = STACKTOP;
 return (0|0); //@line 1017 "/emsdk_portable/sdk/system/include/emscripten/bind.h"
}
function __ZN10emscripten8internal11NoBaseClass13getDowncasterI10NstrumentaEEPFvvEv() {
 var label = 0, sp = 0;
 sp = STACKTOP;
 return (0|0); //@line 1022 "/emsdk_portable/sdk/system/include/emscripten/bind.h"
}
function __ZN10emscripten8internal14raw_destructorI10NstrumentaEEvPT_($0) {
 $0 = $0|0;
 var $1 = 0, $2 = 0, $3 = 0, label = 0, sp = 0;
 sp = STACKTOP;
 STACKTOP = STACKTOP + 16|0; if ((STACKTOP|0) >= (STACK_MAX|0)) abortStackOverflow(16|0);
 $1 = $0;
 $2 = $1; //@line 452 "/emsdk_portable/sdk/system/include/emscripten/bind.h"
 $3 = ($2|0)==(0|0); //@line 452 "/emsdk_portable/sdk/system/include/emscripten/bind.h"
 if (!($3)) {
  __ZdlPv($2); //@line 452 "/emsdk_portable/sdk/system/include/emscripten/bind.h"
 }
 STACKTOP = sp;return; //@line 453 "/emsdk_portable/sdk/system/include/emscripten/bind.h"
}
function __ZN10emscripten8internal6TypeIDI10NstrumentaE3getEv() {
 var $0 = 0, label = 0, sp = 0;
 sp = STACKTOP;
 $0 = (__ZN10emscripten8internal11LightTypeIDI10NstrumentaE3getEv()|0); //@line 98 "/emsdk_portable/sdk/system/include/emscripten/wire.h"
 return ($0|0); //@line 98 "/emsdk_portable/sdk/system/include/emscripten/wire.h"
}
function __ZN10emscripten8internal6TypeIDINS0_17AllowedRawPointerI10NstrumentaEEE3getEv() {
 var $0 = 0, label = 0, sp = 0;
 sp = STACKTOP;
 $0 = (__ZN10emscripten8internal11LightTypeIDIP10NstrumentaE3getEv()|0); //@line 121 "/emsdk_portable/sdk/system/include/emscripten/wire.h"
 return ($0|0); //@line 121 "/emsdk_portable/sdk/system/include/emscripten/wire.h"
}
function __ZN10emscripten8internal6TypeIDINS0_17AllowedRawPointerIK10NstrumentaEEE3getEv() {
 var $0 = 0, label = 0, sp = 0;
 sp = STACKTOP;
 $0 = (__ZN10emscripten8internal11LightTypeIDIPK10NstrumentaE3getEv()|0); //@line 121 "/emsdk_portable/sdk/system/include/emscripten/wire.h"
 return ($0|0); //@line 121 "/emsdk_portable/sdk/system/include/emscripten/wire.h"
}
function __ZN10emscripten8internal11NoBaseClass3getEv() {
 var label = 0, sp = 0;
 sp = STACKTOP;
 return (0|0); //@line 1012 "/emsdk_portable/sdk/system/include/emscripten/bind.h"
}
function __ZN10emscripten8internal14getLightTypeIDI10NstrumentaEEPKvRKT_($0) {
 $0 = $0|0;
 var $1 = 0, label = 0, sp = 0;
 sp = STACKTOP;
 STACKTOP = STACKTOP + 16|0; if ((STACKTOP|0) >= (STACK_MAX|0)) abortStackOverflow(16|0);
 $1 = $0;
 STACKTOP = sp;return (8|0); //@line 82 "/emsdk_portable/sdk/system/include/emscripten/wire.h"
}
function __ZN10emscripten8internal11LightTypeIDI10NstrumentaE3getEv() {
 var label = 0, sp = 0;
 sp = STACKTOP;
 return (8|0); //@line 62 "/emsdk_portable/sdk/system/include/emscripten/wire.h"
}
function __ZN10emscripten8internal11LightTypeIDIP10NstrumentaE3getEv() {
 var label = 0, sp = 0;
 sp = STACKTOP;
 return (16|0); //@line 62 "/emsdk_portable/sdk/system/include/emscripten/wire.h"
}
function __ZN10emscripten8internal11LightTypeIDIPK10NstrumentaE3getEv() {
 var label = 0, sp = 0;
 sp = STACKTOP;
 return (32|0); //@line 62 "/emsdk_portable/sdk/system/include/emscripten/wire.h"
}
function __ZN10emscripten8internal19getGenericSignatureIJiiEEEPKcv() {
 var label = 0, sp = 0;
 sp = STACKTOP;
 return (1169|0); //@line 389 "/emsdk_portable/sdk/system/include/emscripten/bind.h"
}
function __ZN10emscripten8internal19getGenericSignatureIJvEEEPKcv() {
 var label = 0, sp = 0;
 sp = STACKTOP;
 return (1172|0); //@line 389 "/emsdk_portable/sdk/system/include/emscripten/bind.h"
}
function __ZN10emscripten8internal19getGenericSignatureIJviEEEPKcv() {
 var label = 0, sp = 0;
 sp = STACKTOP;
 return (1174|0); //@line 389 "/emsdk_portable/sdk/system/include/emscripten/bind.h"
}
function __ZN10emscripten8internal12operator_newI10NstrumentaJEEEPT_DpOT0_() {
 var $0 = 0, label = 0, sp = 0;
 sp = STACKTOP;
 $0 = (__Znwj(1)|0); //@line 433 "/emsdk_portable/sdk/system/include/emscripten/bind.h"
 __ZN10NstrumentaC2Ev($0); //@line 433 "/emsdk_portable/sdk/system/include/emscripten/bind.h"
 return ($0|0); //@line 433 "/emsdk_portable/sdk/system/include/emscripten/bind.h"
}
function __ZN10emscripten8internal7InvokerIP10NstrumentaJEE6invokeEPFS3_vE($0) {
 $0 = $0|0;
 var $1 = 0, $2 = 0, $3 = 0, $4 = 0, label = 0, sp = 0;
 sp = STACKTOP;
 STACKTOP = STACKTOP + 16|0; if ((STACKTOP|0) >= (STACK_MAX|0)) abortStackOverflow(16|0);
 $1 = $0;
 $2 = $1; //@line 330 "/emsdk_portable/sdk/system/include/emscripten/bind.h"
 $3 = (FUNCTION_TABLE_i[$2 & 31]()|0); //@line 330 "/emsdk_portable/sdk/system/include/emscripten/bind.h"
 $4 = (__ZN10emscripten8internal11BindingTypeIP10NstrumentaE10toWireTypeES3_($3)|0); //@line 329 "/emsdk_portable/sdk/system/include/emscripten/bind.h"
 STACKTOP = sp;return ($4|0); //@line 329 "/emsdk_portable/sdk/system/include/emscripten/bind.h"
}
function __ZNK10emscripten8internal12WithPoliciesIJNS_18allow_raw_pointersEEE11ArgTypeListIJP10NstrumentaEE8getCountEv($0) {
 $0 = $0|0;
 var $1 = 0, label = 0, sp = 0;
 sp = STACKTOP;
 STACKTOP = STACKTOP + 16|0; if ((STACKTOP|0) >= (STACK_MAX|0)) abortStackOverflow(16|0);
 $1 = $0;
 STACKTOP = sp;return 1; //@line 224 "/emsdk_portable/sdk/system/include/emscripten/wire.h"
}
function __ZNK10emscripten8internal12WithPoliciesIJNS_18allow_raw_pointersEEE11ArgTypeListIJP10NstrumentaEE8getTypesEv($0) {
 $0 = $0|0;
 var $1 = 0, $2 = 0, label = 0, sp = 0;
 sp = STACKTOP;
 STACKTOP = STACKTOP + 16|0; if ((STACKTOP|0) >= (STACK_MAX|0)) abortStackOverflow(16|0);
 $1 = $0;
 $2 = (__ZN10emscripten8internal14ArgArrayGetterINS0_8TypeListIJNS0_17AllowedRawPointerI10NstrumentaEEEEEE3getEv()|0); //@line 228 "/emsdk_portable/sdk/system/include/emscripten/wire.h"
 STACKTOP = sp;return ($2|0); //@line 228 "/emsdk_portable/sdk/system/include/emscripten/wire.h"
}
function __ZN10emscripten8internal11BindingTypeIP10NstrumentaE10toWireTypeES3_($0) {
 $0 = $0|0;
 var $1 = 0, $2 = 0, label = 0, sp = 0;
 sp = STACKTOP;
 STACKTOP = STACKTOP + 16|0; if ((STACKTOP|0) >= (STACK_MAX|0)) abortStackOverflow(16|0);
 $1 = $0;
 $2 = $1; //@line 341 "/emsdk_portable/sdk/system/include/emscripten/wire.h"
 STACKTOP = sp;return ($2|0); //@line 341 "/emsdk_portable/sdk/system/include/emscripten/wire.h"
}
function __ZN10emscripten8internal14ArgArrayGetterINS0_8TypeListIJNS0_17AllowedRawPointerI10NstrumentaEEEEEE3getEv() {
 var label = 0, sp = 0;
 sp = STACKTOP;
 return (464|0); //@line 208 "/emsdk_portable/sdk/system/include/emscripten/wire.h"
}
function __ZN10NstrumentaC2Ev($0) {
 $0 = $0|0;
 var $1 = 0, label = 0, sp = 0;
 sp = STACKTOP;
 STACKTOP = STACKTOP + 16|0; if ((STACKTOP|0) >= (STACK_MAX|0)) abortStackOverflow(16|0);
 $1 = $0;
 _algorithm_init(); //@line 13 "nstrumenta.cpp"
 STACKTOP = sp;return; //@line 14 "nstrumenta.cpp"
}
function __ZN10emscripten8internal13MethodInvokerIM10NstrumentaFvvEvPS2_JEE6invokeERKS4_S5_($0,$1) {
 $0 = $0|0;
 $1 = $1|0;
 var $$field = 0, $$field2 = 0, $$index1 = 0, $10 = 0, $11 = 0, $12 = 0, $13 = 0, $14 = 0, $15 = 0, $2 = 0, $3 = 0, $4 = 0, $5 = 0, $6 = 0, $7 = 0, $8 = 0, $9 = 0, label = 0, sp = 0;
 sp = STACKTOP;
 STACKTOP = STACKTOP + 16|0; if ((STACKTOP|0) >= (STACK_MAX|0)) abortStackOverflow(16|0);
 $2 = $0;
 $3 = $1;
 $4 = $3; //@line 510 "/emsdk_portable/sdk/system/include/emscripten/bind.h"
 $5 = (__ZN10emscripten8internal11BindingTypeIP10NstrumentaE12fromWireTypeES3_($4)|0); //@line 510 "/emsdk_portable/sdk/system/include/emscripten/bind.h"
 $6 = $2; //@line 510 "/emsdk_portable/sdk/system/include/emscripten/bind.h"
 $$field = HEAP32[$6>>2]|0; //@line 510 "/emsdk_portable/sdk/system/include/emscripten/bind.h"
 $$index1 = ((($6)) + 4|0); //@line 510 "/emsdk_portable/sdk/system/include/emscripten/bind.h"
 $$field2 = HEAP32[$$index1>>2]|0; //@line 510 "/emsdk_portable/sdk/system/include/emscripten/bind.h"
 $7 = $$field2 >> 1; //@line 510 "/emsdk_portable/sdk/system/include/emscripten/bind.h"
 $8 = (($5) + ($7)|0); //@line 510 "/emsdk_portable/sdk/system/include/emscripten/bind.h"
 $9 = $$field2 & 1; //@line 510 "/emsdk_portable/sdk/system/include/emscripten/bind.h"
 $10 = ($9|0)!=(0); //@line 510 "/emsdk_portable/sdk/system/include/emscripten/bind.h"
 if ($10) {
  $11 = HEAP32[$8>>2]|0; //@line 510 "/emsdk_portable/sdk/system/include/emscripten/bind.h"
  $12 = (($11) + ($$field)|0); //@line 510 "/emsdk_portable/sdk/system/include/emscripten/bind.h"
  $13 = HEAP32[$12>>2]|0; //@line 510 "/emsdk_portable/sdk/system/include/emscripten/bind.h"
  $15 = $13;
  FUNCTION_TABLE_vi[$15 & 31]($8); //@line 510 "/emsdk_portable/sdk/system/include/emscripten/bind.h"
  STACKTOP = sp;return; //@line 510 "/emsdk_portable/sdk/system/include/emscripten/bind.h"
 } else {
  $14 = $$field; //@line 510 "/emsdk_portable/sdk/system/include/emscripten/bind.h"
  $15 = $14;
  FUNCTION_TABLE_vi[$15 & 31]($8); //@line 510 "/emsdk_portable/sdk/system/include/emscripten/bind.h"
  STACKTOP = sp;return; //@line 510 "/emsdk_portable/sdk/system/include/emscripten/bind.h"
 }
}
function __ZNK10emscripten8internal12WithPoliciesIJEE11ArgTypeListIJvNS0_17AllowedRawPointerI10NstrumentaEEEE8getCountEv($0) {
 $0 = $0|0;
 var $1 = 0, label = 0, sp = 0;
 sp = STACKTOP;
 STACKTOP = STACKTOP + 16|0; if ((STACKTOP|0) >= (STACK_MAX|0)) abortStackOverflow(16|0);
 $1 = $0;
 STACKTOP = sp;return 2; //@line 224 "/emsdk_portable/sdk/system/include/emscripten/wire.h"
}
function __ZNK10emscripten8internal12WithPoliciesIJEE11ArgTypeListIJvNS0_17AllowedRawPointerI10NstrumentaEEEE8getTypesEv($0) {
 $0 = $0|0;
 var $1 = 0, $2 = 0, label = 0, sp = 0;
 sp = STACKTOP;
 STACKTOP = STACKTOP + 16|0; if ((STACKTOP|0) >= (STACK_MAX|0)) abortStackOverflow(16|0);
 $1 = $0;
 $2 = (__ZN10emscripten8internal14ArgArrayGetterINS0_8TypeListIJvNS0_17AllowedRawPointerI10NstrumentaEEEEEE3getEv()|0); //@line 228 "/emsdk_portable/sdk/system/include/emscripten/wire.h"
 STACKTOP = sp;return ($2|0); //@line 228 "/emsdk_portable/sdk/system/include/emscripten/wire.h"
}
function __ZN10emscripten8internal10getContextIM10NstrumentaFvvEEEPT_RKS5_($0) {
 $0 = $0|0;
 var $$field = 0, $$field2 = 0, $$index1 = 0, $$index5 = 0, $1 = 0, $2 = 0, $3 = 0, label = 0, sp = 0;
 sp = STACKTOP;
 STACKTOP = STACKTOP + 16|0; if ((STACKTOP|0) >= (STACK_MAX|0)) abortStackOverflow(16|0);
 $1 = $0;
 $2 = (__Znwj(8)|0); //@line 558 "/emsdk_portable/sdk/system/include/emscripten/bind.h"
 $3 = $1; //@line 558 "/emsdk_portable/sdk/system/include/emscripten/bind.h"
 $$field = HEAP32[$3>>2]|0; //@line 558 "/emsdk_portable/sdk/system/include/emscripten/bind.h"
 $$index1 = ((($3)) + 4|0); //@line 558 "/emsdk_portable/sdk/system/include/emscripten/bind.h"
 $$field2 = HEAP32[$$index1>>2]|0; //@line 558 "/emsdk_portable/sdk/system/include/emscripten/bind.h"
 HEAP32[$2>>2] = $$field; //@line 558 "/emsdk_portable/sdk/system/include/emscripten/bind.h"
 $$index5 = ((($2)) + 4|0); //@line 558 "/emsdk_portable/sdk/system/include/emscripten/bind.h"
 HEAP32[$$index5>>2] = $$field2; //@line 558 "/emsdk_portable/sdk/system/include/emscripten/bind.h"
 STACKTOP = sp;return ($2|0); //@line 558 "/emsdk_portable/sdk/system/include/emscripten/bind.h"
}
function __ZN10emscripten8internal11BindingTypeIP10NstrumentaE12fromWireTypeES3_($0) {
 $0 = $0|0;
 var $1 = 0, $2 = 0, label = 0, sp = 0;
 sp = STACKTOP;
 STACKTOP = STACKTOP + 16|0; if ((STACKTOP|0) >= (STACK_MAX|0)) abortStackOverflow(16|0);
 $1 = $0;
 $2 = $1; //@line 344 "/emsdk_portable/sdk/system/include/emscripten/wire.h"
 STACKTOP = sp;return ($2|0); //@line 344 "/emsdk_portable/sdk/system/include/emscripten/wire.h"
}
function __ZN10emscripten8internal14ArgArrayGetterINS0_8TypeListIJvNS0_17AllowedRawPointerI10NstrumentaEEEEEE3getEv() {
 var label = 0, sp = 0;
 sp = STACKTOP;
 return (468|0); //@line 208 "/emsdk_portable/sdk/system/include/emscripten/wire.h"
}
function __ZN10emscripten8internal19getGenericSignatureIJviiEEEPKcv() {
 var label = 0, sp = 0;
 sp = STACKTOP;
 return (1177|0); //@line 389 "/emsdk_portable/sdk/system/include/emscripten/bind.h"
}
function __ZN10emscripten8internal13MethodInvokerIM10NstrumentaFvidEvPS2_JidEE6invokeERKS4_S5_id($0,$1,$2,$3) {
 $0 = $0|0;
 $1 = $1|0;
 $2 = $2|0;
 $3 = +$3;
 var $$field = 0, $$field2 = 0, $$index1 = 0, $10 = 0, $11 = 0, $12 = 0, $13 = 0, $14 = 0, $15 = 0, $16 = 0, $17 = 0, $18 = 0, $19 = 0, $20 = 0, $21 = 0.0, $22 = 0.0, $23 = 0, $4 = 0, $5 = 0, $6 = 0;
 var $7 = 0.0, $8 = 0, $9 = 0, label = 0, sp = 0;
 sp = STACKTOP;
 STACKTOP = STACKTOP + 32|0; if ((STACKTOP|0) >= (STACK_MAX|0)) abortStackOverflow(32|0);
 $4 = $0;
 $5 = $1;
 $6 = $2;
 $7 = $3;
 $8 = $5; //@line 510 "/emsdk_portable/sdk/system/include/emscripten/bind.h"
 $9 = (__ZN10emscripten8internal11BindingTypeIP10NstrumentaE12fromWireTypeES3_($8)|0); //@line 510 "/emsdk_portable/sdk/system/include/emscripten/bind.h"
 $10 = $4; //@line 510 "/emsdk_portable/sdk/system/include/emscripten/bind.h"
 $$field = HEAP32[$10>>2]|0; //@line 510 "/emsdk_portable/sdk/system/include/emscripten/bind.h"
 $$index1 = ((($10)) + 4|0); //@line 510 "/emsdk_portable/sdk/system/include/emscripten/bind.h"
 $$field2 = HEAP32[$$index1>>2]|0; //@line 510 "/emsdk_portable/sdk/system/include/emscripten/bind.h"
 $11 = $$field2 >> 1; //@line 510 "/emsdk_portable/sdk/system/include/emscripten/bind.h"
 $12 = (($9) + ($11)|0); //@line 510 "/emsdk_portable/sdk/system/include/emscripten/bind.h"
 $13 = $$field2 & 1; //@line 510 "/emsdk_portable/sdk/system/include/emscripten/bind.h"
 $14 = ($13|0)!=(0); //@line 510 "/emsdk_portable/sdk/system/include/emscripten/bind.h"
 if ($14) {
  $15 = HEAP32[$12>>2]|0; //@line 510 "/emsdk_portable/sdk/system/include/emscripten/bind.h"
  $16 = (($15) + ($$field)|0); //@line 510 "/emsdk_portable/sdk/system/include/emscripten/bind.h"
  $17 = HEAP32[$16>>2]|0; //@line 510 "/emsdk_portable/sdk/system/include/emscripten/bind.h"
  $23 = $17;
 } else {
  $18 = $$field; //@line 510 "/emsdk_portable/sdk/system/include/emscripten/bind.h"
  $23 = $18;
 }
 $19 = $6; //@line 511 "/emsdk_portable/sdk/system/include/emscripten/bind.h"
 $20 = (__ZN10emscripten8internal11BindingTypeIiE12fromWireTypeEi($19)|0); //@line 511 "/emsdk_portable/sdk/system/include/emscripten/bind.h"
 $21 = $7; //@line 511 "/emsdk_portable/sdk/system/include/emscripten/bind.h"
 $22 = (+__ZN10emscripten8internal11BindingTypeIdE12fromWireTypeEd($21)); //@line 511 "/emsdk_portable/sdk/system/include/emscripten/bind.h"
 FUNCTION_TABLE_viid[$23 & 31]($12,$20,$22); //@line 510 "/emsdk_portable/sdk/system/include/emscripten/bind.h"
 STACKTOP = sp;return; //@line 510 "/emsdk_portable/sdk/system/include/emscripten/bind.h"
}
function __ZNK10emscripten8internal12WithPoliciesIJEE11ArgTypeListIJvNS0_17AllowedRawPointerI10NstrumentaEEidEE8getCountEv($0) {
 $0 = $0|0;
 var $1 = 0, label = 0, sp = 0;
 sp = STACKTOP;
 STACKTOP = STACKTOP + 16|0; if ((STACKTOP|0) >= (STACK_MAX|0)) abortStackOverflow(16|0);
 $1 = $0;
 STACKTOP = sp;return 4; //@line 224 "/emsdk_portable/sdk/system/include/emscripten/wire.h"
}
function __ZNK10emscripten8internal12WithPoliciesIJEE11ArgTypeListIJvNS0_17AllowedRawPointerI10NstrumentaEEidEE8getTypesEv($0) {
 $0 = $0|0;
 var $1 = 0, $2 = 0, label = 0, sp = 0;
 sp = STACKTOP;
 STACKTOP = STACKTOP + 16|0; if ((STACKTOP|0) >= (STACK_MAX|0)) abortStackOverflow(16|0);
 $1 = $0;
 $2 = (__ZN10emscripten8internal14ArgArrayGetterINS0_8TypeListIJvNS0_17AllowedRawPointerI10NstrumentaEEidEEEE3getEv()|0); //@line 228 "/emsdk_portable/sdk/system/include/emscripten/wire.h"
 STACKTOP = sp;return ($2|0); //@line 228 "/emsdk_portable/sdk/system/include/emscripten/wire.h"
}
function __ZN10emscripten8internal10getContextIM10NstrumentaFvidEEEPT_RKS5_($0) {
 $0 = $0|0;
 var $$field = 0, $$field2 = 0, $$index1 = 0, $$index5 = 0, $1 = 0, $2 = 0, $3 = 0, label = 0, sp = 0;
 sp = STACKTOP;
 STACKTOP = STACKTOP + 16|0; if ((STACKTOP|0) >= (STACK_MAX|0)) abortStackOverflow(16|0);
 $1 = $0;
 $2 = (__Znwj(8)|0); //@line 558 "/emsdk_portable/sdk/system/include/emscripten/bind.h"
 $3 = $1; //@line 558 "/emsdk_portable/sdk/system/include/emscripten/bind.h"
 $$field = HEAP32[$3>>2]|0; //@line 558 "/emsdk_portable/sdk/system/include/emscripten/bind.h"
 $$index1 = ((($3)) + 4|0); //@line 558 "/emsdk_portable/sdk/system/include/emscripten/bind.h"
 $$field2 = HEAP32[$$index1>>2]|0; //@line 558 "/emsdk_portable/sdk/system/include/emscripten/bind.h"
 HEAP32[$2>>2] = $$field; //@line 558 "/emsdk_portable/sdk/system/include/emscripten/bind.h"
 $$index5 = ((($2)) + 4|0); //@line 558 "/emsdk_portable/sdk/system/include/emscripten/bind.h"
 HEAP32[$$index5>>2] = $$field2; //@line 558 "/emsdk_portable/sdk/system/include/emscripten/bind.h"
 STACKTOP = sp;return ($2|0); //@line 558 "/emsdk_portable/sdk/system/include/emscripten/bind.h"
}
function __ZN10emscripten8internal11BindingTypeIiE12fromWireTypeEi($0) {
 $0 = $0|0;
 var $1 = 0, $2 = 0, label = 0, sp = 0;
 sp = STACKTOP;
 STACKTOP = STACKTOP + 16|0; if ((STACKTOP|0) >= (STACK_MAX|0)) abortStackOverflow(16|0);
 $1 = $0;
 $2 = $1; //@line 257 "/emsdk_portable/sdk/system/include/emscripten/wire.h"
 STACKTOP = sp;return ($2|0); //@line 257 "/emsdk_portable/sdk/system/include/emscripten/wire.h"
}
function __ZN10emscripten8internal11BindingTypeIdE12fromWireTypeEd($0) {
 $0 = +$0;
 var $1 = 0.0, $2 = 0.0, label = 0, sp = 0;
 sp = STACKTOP;
 STACKTOP = STACKTOP + 16|0; if ((STACKTOP|0) >= (STACK_MAX|0)) abortStackOverflow(16|0);
 $1 = $0;
 $2 = $1; //@line 262 "/emsdk_portable/sdk/system/include/emscripten/wire.h"
 STACKTOP = sp;return (+$2); //@line 262 "/emsdk_portable/sdk/system/include/emscripten/wire.h"
}
function __ZN10emscripten8internal14ArgArrayGetterINS0_8TypeListIJvNS0_17AllowedRawPointerI10NstrumentaEEidEEEE3getEv() {
 var label = 0, sp = 0;
 sp = STACKTOP;
 return (476|0); //@line 208 "/emsdk_portable/sdk/system/include/emscripten/wire.h"
}
function __ZN10emscripten8internal19getGenericSignatureIJviiidEEEPKcv() {
 var label = 0, sp = 0;
 sp = STACKTOP;
 return (1181|0); //@line 389 "/emsdk_portable/sdk/system/include/emscripten/bind.h"
}
function __ZN10emscripten8internal13MethodInvokerIM10NstrumentaFidjiddddddddEiPS2_JdjiddddddddEE6invokeERKS4_S5_djidddddddd($0,$1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12) {
 $0 = $0|0;
 $1 = $1|0;
 $2 = +$2;
 $3 = $3|0;
 $4 = $4|0;
 $5 = +$5;
 $6 = +$6;
 $7 = +$7;
 $8 = +$8;
 $9 = +$9;
 $10 = +$10;
 $11 = +$11;
 $12 = +$12;
 var $$field = 0, $$field2 = 0, $$index1 = 0, $13 = 0, $14 = 0, $15 = 0.0, $16 = 0, $17 = 0, $18 = 0.0, $19 = 0.0, $20 = 0.0, $21 = 0.0, $22 = 0.0, $23 = 0.0, $24 = 0.0, $25 = 0.0, $26 = 0, $27 = 0, $28 = 0, $29 = 0;
 var $30 = 0, $31 = 0, $32 = 0, $33 = 0, $34 = 0, $35 = 0, $36 = 0, $37 = 0, $38 = 0.0, $39 = 0.0, $40 = 0, $41 = 0, $42 = 0, $43 = 0, $44 = 0.0, $45 = 0.0, $46 = 0.0, $47 = 0.0, $48 = 0.0, $49 = 0.0;
 var $50 = 0.0, $51 = 0.0, $52 = 0.0, $53 = 0.0, $54 = 0.0, $55 = 0.0, $56 = 0.0, $57 = 0.0, $58 = 0.0, $59 = 0.0, $60 = 0, $61 = 0, $62 = 0, label = 0, sp = 0;
 sp = STACKTOP;
 STACKTOP = STACKTOP + 96|0; if ((STACKTOP|0) >= (STACK_MAX|0)) abortStackOverflow(96|0);
 $26 = sp + 72|0;
 $13 = $0;
 $14 = $1;
 $15 = $2;
 $16 = $3;
 $17 = $4;
 $18 = $5;
 $19 = $6;
 $20 = $7;
 $21 = $8;
 $22 = $9;
 $23 = $10;
 $24 = $11;
 $25 = $12;
 $27 = $14; //@line 494 "/emsdk_portable/sdk/system/include/emscripten/bind.h"
 $28 = (__ZN10emscripten8internal11BindingTypeIP10NstrumentaE12fromWireTypeES3_($27)|0); //@line 494 "/emsdk_portable/sdk/system/include/emscripten/bind.h"
 $29 = $13; //@line 494 "/emsdk_portable/sdk/system/include/emscripten/bind.h"
 $$field = HEAP32[$29>>2]|0; //@line 494 "/emsdk_portable/sdk/system/include/emscripten/bind.h"
 $$index1 = ((($29)) + 4|0); //@line 494 "/emsdk_portable/sdk/system/include/emscripten/bind.h"
 $$field2 = HEAP32[$$index1>>2]|0; //@line 494 "/emsdk_portable/sdk/system/include/emscripten/bind.h"
 $30 = $$field2 >> 1; //@line 494 "/emsdk_portable/sdk/system/include/emscripten/bind.h"
 $31 = (($28) + ($30)|0); //@line 494 "/emsdk_portable/sdk/system/include/emscripten/bind.h"
 $32 = $$field2 & 1; //@line 494 "/emsdk_portable/sdk/system/include/emscripten/bind.h"
 $33 = ($32|0)!=(0); //@line 494 "/emsdk_portable/sdk/system/include/emscripten/bind.h"
 if ($33) {
  $34 = HEAP32[$31>>2]|0; //@line 494 "/emsdk_portable/sdk/system/include/emscripten/bind.h"
  $35 = (($34) + ($$field)|0); //@line 494 "/emsdk_portable/sdk/system/include/emscripten/bind.h"
  $36 = HEAP32[$35>>2]|0; //@line 494 "/emsdk_portable/sdk/system/include/emscripten/bind.h"
  $60 = $36;
 } else {
  $37 = $$field; //@line 494 "/emsdk_portable/sdk/system/include/emscripten/bind.h"
  $60 = $37;
 }
 $38 = $15; //@line 495 "/emsdk_portable/sdk/system/include/emscripten/bind.h"
 $39 = (+__ZN10emscripten8internal11BindingTypeIdE12fromWireTypeEd($38)); //@line 495 "/emsdk_portable/sdk/system/include/emscripten/bind.h"
 $40 = $16; //@line 495 "/emsdk_portable/sdk/system/include/emscripten/bind.h"
 $41 = (__ZN10emscripten8internal11BindingTypeIjE12fromWireTypeEj($40)|0); //@line 495 "/emsdk_portable/sdk/system/include/emscripten/bind.h"
 $42 = $17; //@line 495 "/emsdk_portable/sdk/system/include/emscripten/bind.h"
 $43 = (__ZN10emscripten8internal11BindingTypeIiE12fromWireTypeEi($42)|0); //@line 495 "/emsdk_portable/sdk/system/include/emscripten/bind.h"
 $44 = $18; //@line 495 "/emsdk_portable/sdk/system/include/emscripten/bind.h"
 $45 = (+__ZN10emscripten8internal11BindingTypeIdE12fromWireTypeEd($44)); //@line 495 "/emsdk_portable/sdk/system/include/emscripten/bind.h"
 $46 = $19; //@line 495 "/emsdk_portable/sdk/system/include/emscripten/bind.h"
 $47 = (+__ZN10emscripten8internal11BindingTypeIdE12fromWireTypeEd($46)); //@line 495 "/emsdk_portable/sdk/system/include/emscripten/bind.h"
 $48 = $20; //@line 495 "/emsdk_portable/sdk/system/include/emscripten/bind.h"
 $49 = (+__ZN10emscripten8internal11BindingTypeIdE12fromWireTypeEd($48)); //@line 495 "/emsdk_portable/sdk/system/include/emscripten/bind.h"
 $50 = $21; //@line 495 "/emsdk_portable/sdk/system/include/emscripten/bind.h"
 $51 = (+__ZN10emscripten8internal11BindingTypeIdE12fromWireTypeEd($50)); //@line 495 "/emsdk_portable/sdk/system/include/emscripten/bind.h"
 $52 = $22; //@line 495 "/emsdk_portable/sdk/system/include/emscripten/bind.h"
 $53 = (+__ZN10emscripten8internal11BindingTypeIdE12fromWireTypeEd($52)); //@line 495 "/emsdk_portable/sdk/system/include/emscripten/bind.h"
 $54 = $23; //@line 495 "/emsdk_portable/sdk/system/include/emscripten/bind.h"
 $55 = (+__ZN10emscripten8internal11BindingTypeIdE12fromWireTypeEd($54)); //@line 495 "/emsdk_portable/sdk/system/include/emscripten/bind.h"
 $56 = $24; //@line 495 "/emsdk_portable/sdk/system/include/emscripten/bind.h"
 $57 = (+__ZN10emscripten8internal11BindingTypeIdE12fromWireTypeEd($56)); //@line 495 "/emsdk_portable/sdk/system/include/emscripten/bind.h"
 $58 = $25; //@line 495 "/emsdk_portable/sdk/system/include/emscripten/bind.h"
 $59 = (+__ZN10emscripten8internal11BindingTypeIdE12fromWireTypeEd($58)); //@line 495 "/emsdk_portable/sdk/system/include/emscripten/bind.h"
 $61 = (FUNCTION_TABLE_iidiidddddddd[$60 & 63]($31,$39,$41,$43,$45,$47,$49,$51,$53,$55,$57,$59)|0); //@line 494 "/emsdk_portable/sdk/system/include/emscripten/bind.h"
 HEAP32[$26>>2] = $61; //@line 494 "/emsdk_portable/sdk/system/include/emscripten/bind.h"
 $62 = (__ZN10emscripten8internal11BindingTypeIiE10toWireTypeERKi($26)|0); //@line 493 "/emsdk_portable/sdk/system/include/emscripten/bind.h"
 STACKTOP = sp;return ($62|0); //@line 493 "/emsdk_portable/sdk/system/include/emscripten/bind.h"
}
function __ZNK10emscripten8internal12WithPoliciesIJEE11ArgTypeListIJiNS0_17AllowedRawPointerI10NstrumentaEEdjiddddddddEE8getCountEv($0) {
 $0 = $0|0;
 var $1 = 0, label = 0, sp = 0;
 sp = STACKTOP;
 STACKTOP = STACKTOP + 16|0; if ((STACKTOP|0) >= (STACK_MAX|0)) abortStackOverflow(16|0);
 $1 = $0;
 STACKTOP = sp;return 13; //@line 224 "/emsdk_portable/sdk/system/include/emscripten/wire.h"
}
function __ZNK10emscripten8internal12WithPoliciesIJEE11ArgTypeListIJiNS0_17AllowedRawPointerI10NstrumentaEEdjiddddddddEE8getTypesEv($0) {
 $0 = $0|0;
 var $1 = 0, $2 = 0, label = 0, sp = 0;
 sp = STACKTOP;
 STACKTOP = STACKTOP + 16|0; if ((STACKTOP|0) >= (STACK_MAX|0)) abortStackOverflow(16|0);
 $1 = $0;
 $2 = (__ZN10emscripten8internal14ArgArrayGetterINS0_8TypeListIJiNS0_17AllowedRawPointerI10NstrumentaEEdjiddddddddEEEE3getEv()|0); //@line 228 "/emsdk_portable/sdk/system/include/emscripten/wire.h"
 STACKTOP = sp;return ($2|0); //@line 228 "/emsdk_portable/sdk/system/include/emscripten/wire.h"
}
function __ZN10emscripten8internal10getContextIM10NstrumentaFidjiddddddddEEEPT_RKS5_($0) {
 $0 = $0|0;
 var $$field = 0, $$field2 = 0, $$index1 = 0, $$index5 = 0, $1 = 0, $2 = 0, $3 = 0, label = 0, sp = 0;
 sp = STACKTOP;
 STACKTOP = STACKTOP + 16|0; if ((STACKTOP|0) >= (STACK_MAX|0)) abortStackOverflow(16|0);
 $1 = $0;
 $2 = (__Znwj(8)|0); //@line 558 "/emsdk_portable/sdk/system/include/emscripten/bind.h"
 $3 = $1; //@line 558 "/emsdk_portable/sdk/system/include/emscripten/bind.h"
 $$field = HEAP32[$3>>2]|0; //@line 558 "/emsdk_portable/sdk/system/include/emscripten/bind.h"
 $$index1 = ((($3)) + 4|0); //@line 558 "/emsdk_portable/sdk/system/include/emscripten/bind.h"
 $$field2 = HEAP32[$$index1>>2]|0; //@line 558 "/emsdk_portable/sdk/system/include/emscripten/bind.h"
 HEAP32[$2>>2] = $$field; //@line 558 "/emsdk_portable/sdk/system/include/emscripten/bind.h"
 $$index5 = ((($2)) + 4|0); //@line 558 "/emsdk_portable/sdk/system/include/emscripten/bind.h"
 HEAP32[$$index5>>2] = $$field2; //@line 558 "/emsdk_portable/sdk/system/include/emscripten/bind.h"
 STACKTOP = sp;return ($2|0); //@line 558 "/emsdk_portable/sdk/system/include/emscripten/bind.h"
}
function __ZN10emscripten8internal11BindingTypeIiE10toWireTypeERKi($0) {
 $0 = $0|0;
 var $1 = 0, $2 = 0, $3 = 0, label = 0, sp = 0;
 sp = STACKTOP;
 STACKTOP = STACKTOP + 16|0; if ((STACKTOP|0) >= (STACK_MAX|0)) abortStackOverflow(16|0);
 $1 = $0;
 $2 = $1; //@line 257 "/emsdk_portable/sdk/system/include/emscripten/wire.h"
 $3 = HEAP32[$2>>2]|0; //@line 257 "/emsdk_portable/sdk/system/include/emscripten/wire.h"
 STACKTOP = sp;return ($3|0); //@line 257 "/emsdk_portable/sdk/system/include/emscripten/wire.h"
}
function __ZN10emscripten8internal11BindingTypeIjE12fromWireTypeEj($0) {
 $0 = $0|0;
 var $1 = 0, $2 = 0, label = 0, sp = 0;
 sp = STACKTOP;
 STACKTOP = STACKTOP + 16|0; if ((STACKTOP|0) >= (STACK_MAX|0)) abortStackOverflow(16|0);
 $1 = $0;
 $2 = $1; //@line 258 "/emsdk_portable/sdk/system/include/emscripten/wire.h"
 STACKTOP = sp;return ($2|0); //@line 258 "/emsdk_portable/sdk/system/include/emscripten/wire.h"
}
function __ZN10emscripten8internal14ArgArrayGetterINS0_8TypeListIJiNS0_17AllowedRawPointerI10NstrumentaEEdjiddddddddEEEE3getEv() {
 var label = 0, sp = 0;
 sp = STACKTOP;
 return (492|0); //@line 208 "/emsdk_portable/sdk/system/include/emscripten/wire.h"
}
function __ZN10emscripten8internal19getGenericSignatureIJiiidiiddddddddEEEPKcv() {
 var label = 0, sp = 0;
 sp = STACKTOP;
 return (1187|0); //@line 389 "/emsdk_portable/sdk/system/include/emscripten/bind.h"
}
function __GLOBAL__sub_I_nstrumenta_cpp() {
 var label = 0, sp = 0;
 sp = STACKTOP;
 ___cxx_global_var_init();
 return;
}
function _algorithm_init() {
 var label = 0, sp = 0;
 sp = STACKTOP;
 _imu_init(2912); //@line 6 "../../src/nst_main.c"
 return; //@line 7 "../../src/nst_main.c"
}
function _algorithm_update($0,$1,$2) {
 $0 = $0|0;
 $1 = $1|0;
 $2 = $2|0;
 var $$byval_copy = 0, $3 = 0, $4 = 0, $5 = 0, $6 = 0, label = 0, sp = 0;
 sp = STACKTOP;
 STACKTOP = STACKTOP + 160|0; if ((STACKTOP|0) >= (STACK_MAX|0)) abortStackOverflow(160|0);
 $$byval_copy = sp;
 $3 = $1;
 $4 = $2;
 $5 = $3; //@line 11 "../../src/nst_main.c"
 $6 = $4; //@line 11 "../../src/nst_main.c"
 _memcpy(($$byval_copy|0),($0|0),144)|0; //@line 11 "../../src/nst_main.c"
 _imu_update(2912,$$byval_copy,$5,$6); //@line 11 "../../src/nst_main.c"
 STACKTOP = sp;return; //@line 12 "../../src/nst_main.c"
}
function _quaternion($0,$1,$2,$3,$4) {
 $0 = $0|0;
 $1 = +$1;
 $2 = +$2;
 $3 = +$3;
 $4 = +$4;
 var $10 = 0.0, $11 = 0, $12 = 0.0, $13 = 0, $14 = 0.0, $15 = 0, $16 = 0.0, $5 = 0.0, $6 = 0.0, $7 = 0.0, $8 = 0.0, $9 = 0, label = 0, sp = 0;
 sp = STACKTOP;
 STACKTOP = STACKTOP + 32|0; if ((STACKTOP|0) >= (STACK_MAX|0)) abortStackOverflow(32|0);
 $9 = sp;
 $5 = $1;
 $6 = $2;
 $7 = $3;
 $8 = $4;
 $10 = $8; //@line 22 "../../src/quaternion/quaternion.c"
 HEAPF32[$9>>2] = $10; //@line 22 "../../src/quaternion/quaternion.c"
 $11 = ((($9)) + 4|0); //@line 22 "../../src/quaternion/quaternion.c"
 $12 = $5; //@line 22 "../../src/quaternion/quaternion.c"
 HEAPF32[$11>>2] = $12; //@line 22 "../../src/quaternion/quaternion.c"
 $13 = ((($9)) + 8|0); //@line 22 "../../src/quaternion/quaternion.c"
 $14 = $6; //@line 22 "../../src/quaternion/quaternion.c"
 HEAPF32[$13>>2] = $14; //@line 22 "../../src/quaternion/quaternion.c"
 $15 = ((($9)) + 12|0); //@line 22 "../../src/quaternion/quaternion.c"
 $16 = $7; //@line 22 "../../src/quaternion/quaternion.c"
 HEAPF32[$15>>2] = $16; //@line 22 "../../src/quaternion/quaternion.c"
 ;HEAP32[$0>>2]=HEAP32[$9>>2]|0;HEAP32[$0+4>>2]=HEAP32[$9+4>>2]|0;HEAP32[$0+8>>2]=HEAP32[$9+8>>2]|0;HEAP32[$0+12>>2]=HEAP32[$9+12>>2]|0; //@line 23 "../../src/quaternion/quaternion.c"
 STACKTOP = sp;return; //@line 23 "../../src/quaternion/quaternion.c"
}
function _quaternion_log($0,$1) {
 $0 = $0|0;
 $1 = $1|0;
 var $10 = 0.0, $11 = 0, $12 = 0.0, $13 = 0.0, $14 = 0, $15 = 0.0, $16 = 0, $17 = 0.0, $18 = 0.0, $19 = 0.0, $2 = 0.0, $20 = 0, $21 = 0.0, $22 = 0, $23 = 0.0, $24 = 0.0, $25 = 0.0, $26 = 0.0, $27 = 0.0, $28 = 0.0;
 var $29 = 0.0, $3 = 0, $30 = 0.0, $31 = 0.0, $32 = 0.0, $33 = 0.0, $34 = 0.0, $35 = 0.0, $36 = 0, $37 = 0.0, $38 = 0.0, $39 = 0, $4 = 0, $40 = 0.0, $41 = 0.0, $42 = 0.0, $43 = 0.0, $44 = 0, $45 = 0.0, $46 = 0.0;
 var $47 = 0.0, $48 = 0.0, $49 = 0.0, $5 = 0, $50 = 0, $51 = 0, $52 = 0, $53 = 0.0, $54 = 0.0, $55 = 0.0, $56 = 0.0, $57 = 0, $58 = 0, $59 = 0, $6 = 0.0, $60 = 0.0, $61 = 0.0, $62 = 0.0, $63 = 0.0, $64 = 0.0;
 var $65 = 0.0, $66 = 0.0, $67 = 0.0, $68 = 0.0, $69 = 0.0, $7 = 0.0, $70 = 0.0, $71 = 0.0, $72 = 0.0, $73 = 0.0, $74 = 0.0, $75 = 0.0, $76 = 0.0, $77 = 0.0, $78 = 0.0, $79 = 0.0, $8 = 0, $80 = 0, $81 = 0.0, $82 = 0;
 var $83 = 0.0, $84 = 0.0, $85 = 0, $86 = 0.0, $87 = 0, $88 = 0.0, $89 = 0.0, $9 = 0, $90 = 0, $91 = 0.0, $92 = 0, $93 = 0.0, $94 = 0.0, label = 0, sp = 0;
 sp = STACKTOP;
 STACKTOP = STACKTOP + 80|0; if ((STACKTOP|0) >= (STACK_MAX|0)) abortStackOverflow(80|0);
 $3 = sp + 56|0;
 $4 = sp + 40|0;
 $5 = sp + 24|0;
 $8 = sp;
 $9 = ((($1)) + 4|0); //@line 72 "../../src/quaternion/quaternion.c"
 $10 = +HEAPF32[$9>>2]; //@line 72 "../../src/quaternion/quaternion.c"
 $11 = ((($1)) + 4|0); //@line 72 "../../src/quaternion/quaternion.c"
 $12 = +HEAPF32[$11>>2]; //@line 72 "../../src/quaternion/quaternion.c"
 $13 = $10 * $12; //@line 72 "../../src/quaternion/quaternion.c"
 $14 = ((($1)) + 8|0); //@line 72 "../../src/quaternion/quaternion.c"
 $15 = +HEAPF32[$14>>2]; //@line 72 "../../src/quaternion/quaternion.c"
 $16 = ((($1)) + 8|0); //@line 72 "../../src/quaternion/quaternion.c"
 $17 = +HEAPF32[$16>>2]; //@line 72 "../../src/quaternion/quaternion.c"
 $18 = $15 * $17; //@line 72 "../../src/quaternion/quaternion.c"
 $19 = $13 + $18; //@line 72 "../../src/quaternion/quaternion.c"
 $20 = ((($1)) + 12|0); //@line 72 "../../src/quaternion/quaternion.c"
 $21 = +HEAPF32[$20>>2]; //@line 72 "../../src/quaternion/quaternion.c"
 $22 = ((($1)) + 12|0); //@line 72 "../../src/quaternion/quaternion.c"
 $23 = +HEAPF32[$22>>2]; //@line 72 "../../src/quaternion/quaternion.c"
 $24 = $21 * $23; //@line 72 "../../src/quaternion/quaternion.c"
 $25 = $19 + $24; //@line 72 "../../src/quaternion/quaternion.c"
 $26 = $25; //@line 72 "../../src/quaternion/quaternion.c"
 $27 = (+Math_sqrt((+$26))); //@line 72 "../../src/quaternion/quaternion.c"
 $28 = $27; //@line 72 "../../src/quaternion/quaternion.c"
 $2 = $28; //@line 72 "../../src/quaternion/quaternion.c"
 $29 = $2; //@line 73 "../../src/quaternion/quaternion.c"
 $30 = $29; //@line 73 "../../src/quaternion/quaternion.c"
 $31 = (+Math_abs((+$30))); //@line 73 "../../src/quaternion/quaternion.c"
 $32 = +HEAPF32[$1>>2]; //@line 73 "../../src/quaternion/quaternion.c"
 $33 = $32; //@line 73 "../../src/quaternion/quaternion.c"
 $34 = (+Math_abs((+$33))); //@line 73 "../../src/quaternion/quaternion.c"
 $35 = 9.9999999999999999E-15 * $34; //@line 73 "../../src/quaternion/quaternion.c"
 $36 = $31 <= $35; //@line 73 "../../src/quaternion/quaternion.c"
 if (!($36)) {
  $60 = $2; //@line 97 "../../src/quaternion/quaternion.c"
  $61 = $60; //@line 97 "../../src/quaternion/quaternion.c"
  $62 = +HEAPF32[$1>>2]; //@line 97 "../../src/quaternion/quaternion.c"
  $63 = $62; //@line 97 "../../src/quaternion/quaternion.c"
  $64 = (+Math_atan2((+$61),(+$63))); //@line 97 "../../src/quaternion/quaternion.c"
  $65 = $64; //@line 97 "../../src/quaternion/quaternion.c"
  $6 = $65; //@line 97 "../../src/quaternion/quaternion.c"
  $66 = $6; //@line 98 "../../src/quaternion/quaternion.c"
  $67 = $2; //@line 98 "../../src/quaternion/quaternion.c"
  $68 = $66 / $67; //@line 98 "../../src/quaternion/quaternion.c"
  $7 = $68; //@line 98 "../../src/quaternion/quaternion.c"
  $69 = +HEAPF32[$1>>2]; //@line 99 "../../src/quaternion/quaternion.c"
  $70 = +HEAPF32[$1>>2]; //@line 99 "../../src/quaternion/quaternion.c"
  $71 = $69 * $70; //@line 99 "../../src/quaternion/quaternion.c"
  $72 = $2; //@line 99 "../../src/quaternion/quaternion.c"
  $73 = $2; //@line 99 "../../src/quaternion/quaternion.c"
  $74 = $72 * $73; //@line 99 "../../src/quaternion/quaternion.c"
  $75 = $71 + $74; //@line 99 "../../src/quaternion/quaternion.c"
  $76 = $75; //@line 99 "../../src/quaternion/quaternion.c"
  $77 = (+Math_log((+$76))); //@line 99 "../../src/quaternion/quaternion.c"
  $78 = $77 / 2.0; //@line 99 "../../src/quaternion/quaternion.c"
  $79 = $78; //@line 99 "../../src/quaternion/quaternion.c"
  HEAPF32[$8>>2] = $79; //@line 99 "../../src/quaternion/quaternion.c"
  $80 = ((($8)) + 4|0); //@line 99 "../../src/quaternion/quaternion.c"
  $81 = $7; //@line 99 "../../src/quaternion/quaternion.c"
  $82 = ((($1)) + 4|0); //@line 99 "../../src/quaternion/quaternion.c"
  $83 = +HEAPF32[$82>>2]; //@line 99 "../../src/quaternion/quaternion.c"
  $84 = $81 * $83; //@line 99 "../../src/quaternion/quaternion.c"
  HEAPF32[$80>>2] = $84; //@line 99 "../../src/quaternion/quaternion.c"
  $85 = ((($8)) + 8|0); //@line 99 "../../src/quaternion/quaternion.c"
  $86 = $7; //@line 99 "../../src/quaternion/quaternion.c"
  $87 = ((($1)) + 8|0); //@line 99 "../../src/quaternion/quaternion.c"
  $88 = +HEAPF32[$87>>2]; //@line 99 "../../src/quaternion/quaternion.c"
  $89 = $86 * $88; //@line 99 "../../src/quaternion/quaternion.c"
  HEAPF32[$85>>2] = $89; //@line 99 "../../src/quaternion/quaternion.c"
  $90 = ((($8)) + 12|0); //@line 99 "../../src/quaternion/quaternion.c"
  $91 = $7; //@line 99 "../../src/quaternion/quaternion.c"
  $92 = ((($1)) + 12|0); //@line 99 "../../src/quaternion/quaternion.c"
  $93 = +HEAPF32[$92>>2]; //@line 99 "../../src/quaternion/quaternion.c"
  $94 = $91 * $93; //@line 99 "../../src/quaternion/quaternion.c"
  HEAPF32[$90>>2] = $94; //@line 99 "../../src/quaternion/quaternion.c"
  ;HEAP32[$0>>2]=HEAP32[$8>>2]|0;HEAP32[$0+4>>2]=HEAP32[$8+4>>2]|0;HEAP32[$0+8>>2]=HEAP32[$8+8>>2]|0;HEAP32[$0+12>>2]=HEAP32[$8+12>>2]|0; //@line 100 "../../src/quaternion/quaternion.c"
  STACKTOP = sp;return; //@line 102 "../../src/quaternion/quaternion.c"
 }
 $37 = +HEAPF32[$1>>2]; //@line 75 "../../src/quaternion/quaternion.c"
 $38 = $37; //@line 75 "../../src/quaternion/quaternion.c"
 $39 = $38 < 0.0; //@line 75 "../../src/quaternion/quaternion.c"
 if (!($39)) {
  $53 = +HEAPF32[$1>>2]; //@line 91 "../../src/quaternion/quaternion.c"
  $54 = $53; //@line 91 "../../src/quaternion/quaternion.c"
  $55 = (+Math_log((+$54))); //@line 91 "../../src/quaternion/quaternion.c"
  $56 = $55; //@line 91 "../../src/quaternion/quaternion.c"
  HEAPF32[$5>>2] = $56; //@line 91 "../../src/quaternion/quaternion.c"
  $57 = ((($5)) + 4|0); //@line 91 "../../src/quaternion/quaternion.c"
  HEAPF32[$57>>2] = 0.0; //@line 91 "../../src/quaternion/quaternion.c"
  $58 = ((($5)) + 8|0); //@line 91 "../../src/quaternion/quaternion.c"
  HEAPF32[$58>>2] = 0.0; //@line 91 "../../src/quaternion/quaternion.c"
  $59 = ((($5)) + 12|0); //@line 91 "../../src/quaternion/quaternion.c"
  HEAPF32[$59>>2] = 0.0; //@line 91 "../../src/quaternion/quaternion.c"
  ;HEAP32[$0>>2]=HEAP32[$5>>2]|0;HEAP32[$0+4>>2]=HEAP32[$5+4>>2]|0;HEAP32[$0+8>>2]=HEAP32[$5+8>>2]|0;HEAP32[$0+12>>2]=HEAP32[$5+12>>2]|0; //@line 92 "../../src/quaternion/quaternion.c"
  STACKTOP = sp;return; //@line 102 "../../src/quaternion/quaternion.c"
 }
 $40 = +HEAPF32[$1>>2]; //@line 78 "../../src/quaternion/quaternion.c"
 $41 = $40 + 1.0; //@line 78 "../../src/quaternion/quaternion.c"
 $42 = $41; //@line 78 "../../src/quaternion/quaternion.c"
 $43 = (+Math_abs((+$42))); //@line 78 "../../src/quaternion/quaternion.c"
 $44 = $43 > 9.9999999999999999E-15; //@line 78 "../../src/quaternion/quaternion.c"
 if ($44) {
  $45 = +HEAPF32[$1>>2]; //@line 80 "../../src/quaternion/quaternion.c"
  $46 = - $45; //@line 80 "../../src/quaternion/quaternion.c"
  $47 = $46; //@line 80 "../../src/quaternion/quaternion.c"
  $48 = (+Math_log((+$47))); //@line 80 "../../src/quaternion/quaternion.c"
  $49 = $48; //@line 80 "../../src/quaternion/quaternion.c"
  HEAPF32[$3>>2] = $49; //@line 80 "../../src/quaternion/quaternion.c"
  $50 = ((($3)) + 4|0); //@line 80 "../../src/quaternion/quaternion.c"
  HEAPF32[$50>>2] = 3.1415927410125732; //@line 80 "../../src/quaternion/quaternion.c"
  $51 = ((($3)) + 8|0); //@line 80 "../../src/quaternion/quaternion.c"
  HEAPF32[$51>>2] = 0.0; //@line 80 "../../src/quaternion/quaternion.c"
  $52 = ((($3)) + 12|0); //@line 80 "../../src/quaternion/quaternion.c"
  HEAPF32[$52>>2] = 0.0; //@line 80 "../../src/quaternion/quaternion.c"
  ;HEAP32[$0>>2]=HEAP32[$3>>2]|0;HEAP32[$0+4>>2]=HEAP32[$3+4>>2]|0;HEAP32[$0+8>>2]=HEAP32[$3+8>>2]|0;HEAP32[$0+12>>2]=HEAP32[$3+12>>2]|0; //@line 81 "../../src/quaternion/quaternion.c"
  STACKTOP = sp;return; //@line 102 "../../src/quaternion/quaternion.c"
 } else {
  ;HEAP32[$4>>2]=HEAP32[544>>2]|0;HEAP32[$4+4>>2]=HEAP32[544+4>>2]|0;HEAP32[$4+8>>2]=HEAP32[544+8>>2]|0;HEAP32[$4+12>>2]=HEAP32[544+12>>2]|0; //@line 85 "../../src/quaternion/quaternion.c"
  ;HEAP32[$0>>2]=HEAP32[$4>>2]|0;HEAP32[$0+4>>2]=HEAP32[$4+4>>2]|0;HEAP32[$0+8>>2]=HEAP32[$4+8>>2]|0;HEAP32[$0+12>>2]=HEAP32[$4+12>>2]|0; //@line 86 "../../src/quaternion/quaternion.c"
  STACKTOP = sp;return; //@line 102 "../../src/quaternion/quaternion.c"
 }
}
function _imu_init($0) {
 $0 = $0|0;
 var $1 = 0, $10 = 0, $11 = 0, $12 = 0, $13 = 0, $14 = 0, $15 = 0, $16 = 0, $17 = 0, $18 = 0, $19 = 0, $2 = 0, $20 = 0, $21 = 0, $22 = 0, $23 = 0, $24 = 0, $25 = 0, $26 = 0, $27 = 0;
 var $28 = 0, $29 = 0, $3 = 0, $30 = 0, $31 = 0, $32 = 0, $33 = 0, $34 = 0, $35 = 0, $36 = 0, $37 = 0, $38 = 0, $39 = 0, $4 = 0, $40 = 0, $41 = 0, $42 = 0, $43 = 0, $44 = 0, $45 = 0;
 var $46 = 0, $47 = 0, $48 = 0, $49 = 0, $5 = 0, $50 = 0, $51 = 0, $52 = 0, $53 = 0, $54 = 0, $55 = 0, $56 = 0, $57 = 0, $58 = 0, $59 = 0, $6 = 0, $60 = 0, $61 = 0, $62 = 0, $63 = 0;
 var $64 = 0, $65 = 0, $66 = 0, $67 = 0, $68 = 0, $69 = 0, $7 = 0, $70 = 0, $71 = 0, $8 = 0, $9 = 0, label = 0, sp = 0;
 sp = STACKTOP;
 STACKTOP = STACKTOP + 192|0; if ((STACKTOP|0) >= (STACK_MAX|0)) abortStackOverflow(192|0);
 $2 = sp + 176|0;
 $3 = sp + 160|0;
 $4 = sp + 144|0;
 $5 = sp + 128|0;
 $6 = sp + 112|0;
 $7 = sp + 96|0;
 $8 = sp + 84|0;
 $9 = sp + 72|0;
 $10 = sp + 60|0;
 $11 = sp + 48|0;
 $12 = sp + 36|0;
 $13 = sp + 24|0;
 $14 = sp + 12|0;
 $15 = sp;
 $1 = $0;
 $16 = $1; //@line 11 "../../src/imu/imu.c"
 $17 = ((($16)) + 1168|0); //@line 11 "../../src/imu/imu.c"
 HEAPF64[$17>>3] = 0.0; //@line 11 "../../src/imu/imu.c"
 $18 = $1; //@line 12 "../../src/imu/imu.c"
 $19 = ((($18)) + 1184|0); //@line 12 "../../src/imu/imu.c"
 HEAPF64[$19>>3] = 0.0; //@line 12 "../../src/imu/imu.c"
 $20 = $1; //@line 14 "../../src/imu/imu.c"
 HEAP32[$20>>2] = 0; //@line 14 "../../src/imu/imu.c"
 $21 = $1; //@line 16 "../../src/imu/imu.c"
 $22 = ((($21)) + 8|0); //@line 16 "../../src/imu/imu.c"
 HEAPF64[$22>>3] = 0.0; //@line 16 "../../src/imu/imu.c"
 $23 = $1; //@line 17 "../../src/imu/imu.c"
 $24 = ((($23)) + 16|0); //@line 17 "../../src/imu/imu.c"
 _vec3_10($2,0.0,0.0,0.0); //@line 17 "../../src/imu/imu.c"
 ;HEAP32[$24>>2]=HEAP32[$2>>2]|0;HEAP32[$24+4>>2]=HEAP32[$2+4>>2]|0;HEAP32[$24+8>>2]=HEAP32[$2+8>>2]|0; //@line 17 "../../src/imu/imu.c"
 $25 = $1; //@line 19 "../../src/imu/imu.c"
 $26 = ((($25)) + 1312|0); //@line 19 "../../src/imu/imu.c"
 $27 = ((($26)) + 24|0); //@line 19 "../../src/imu/imu.c"
 _quaternion($3,0.0,0.0,0.0,1.0); //@line 19 "../../src/imu/imu.c"
 ;HEAP32[$27>>2]=HEAP32[$3>>2]|0;HEAP32[$27+4>>2]=HEAP32[$3+4>>2]|0;HEAP32[$27+8>>2]=HEAP32[$3+8>>2]|0;HEAP32[$27+12>>2]=HEAP32[$3+12>>2]|0; //@line 19 "../../src/imu/imu.c"
 $28 = $1; //@line 20 "../../src/imu/imu.c"
 $29 = ((($28)) + 1312|0); //@line 20 "../../src/imu/imu.c"
 $30 = ((($29)) + 40|0); //@line 20 "../../src/imu/imu.c"
 _vec3_10($4,0.0,0.0,0.0); //@line 20 "../../src/imu/imu.c"
 ;HEAP32[$30>>2]=HEAP32[$4>>2]|0;HEAP32[$30+4>>2]=HEAP32[$4+4>>2]|0;HEAP32[$30+8>>2]=HEAP32[$4+8>>2]|0; //@line 20 "../../src/imu/imu.c"
 $31 = $1; //@line 21 "../../src/imu/imu.c"
 $32 = ((($31)) + 1312|0); //@line 21 "../../src/imu/imu.c"
 $33 = ((($32)) + 56|0); //@line 21 "../../src/imu/imu.c"
 HEAPF64[$33>>3] = 0.0; //@line 21 "../../src/imu/imu.c"
 $34 = $1; //@line 23 "../../src/imu/imu.c"
 $35 = ((($34)) + 1376|0); //@line 23 "../../src/imu/imu.c"
 $36 = ((($35)) + 24|0); //@line 23 "../../src/imu/imu.c"
 _quaternion($5,0.0,0.0,0.0,1.0); //@line 23 "../../src/imu/imu.c"
 ;HEAP32[$36>>2]=HEAP32[$5>>2]|0;HEAP32[$36+4>>2]=HEAP32[$5+4>>2]|0;HEAP32[$36+8>>2]=HEAP32[$5+8>>2]|0;HEAP32[$36+12>>2]=HEAP32[$5+12>>2]|0; //@line 23 "../../src/imu/imu.c"
 $37 = $1; //@line 24 "../../src/imu/imu.c"
 $38 = ((($37)) + 1376|0); //@line 24 "../../src/imu/imu.c"
 $39 = ((($38)) + 40|0); //@line 24 "../../src/imu/imu.c"
 _vec3_10($6,0.0,0.0,0.0); //@line 24 "../../src/imu/imu.c"
 ;HEAP32[$39>>2]=HEAP32[$6>>2]|0;HEAP32[$39+4>>2]=HEAP32[$6+4>>2]|0;HEAP32[$39+8>>2]=HEAP32[$6+8>>2]|0; //@line 24 "../../src/imu/imu.c"
 $40 = $1; //@line 25 "../../src/imu/imu.c"
 $41 = ((($40)) + 1376|0); //@line 25 "../../src/imu/imu.c"
 $42 = ((($41)) + 56|0); //@line 25 "../../src/imu/imu.c"
 HEAPF64[$42>>3] = 0.0; //@line 25 "../../src/imu/imu.c"
 $43 = $1; //@line 27 "../../src/imu/imu.c"
 $44 = ((($43)) + 1440|0); //@line 27 "../../src/imu/imu.c"
 $45 = ((($44)) + 24|0); //@line 27 "../../src/imu/imu.c"
 _quaternion($7,0.0,0.0,0.0,1.0); //@line 27 "../../src/imu/imu.c"
 ;HEAP32[$45>>2]=HEAP32[$7>>2]|0;HEAP32[$45+4>>2]=HEAP32[$7+4>>2]|0;HEAP32[$45+8>>2]=HEAP32[$7+8>>2]|0;HEAP32[$45+12>>2]=HEAP32[$7+12>>2]|0; //@line 27 "../../src/imu/imu.c"
 $46 = $1; //@line 28 "../../src/imu/imu.c"
 $47 = ((($46)) + 1440|0); //@line 28 "../../src/imu/imu.c"
 $48 = ((($47)) + 40|0); //@line 28 "../../src/imu/imu.c"
 _vec3_10($8,0.0,0.0,0.0); //@line 28 "../../src/imu/imu.c"
 ;HEAP32[$48>>2]=HEAP32[$8>>2]|0;HEAP32[$48+4>>2]=HEAP32[$8+4>>2]|0;HEAP32[$48+8>>2]=HEAP32[$8+8>>2]|0; //@line 28 "../../src/imu/imu.c"
 $49 = $1; //@line 29 "../../src/imu/imu.c"
 $50 = ((($49)) + 1440|0); //@line 29 "../../src/imu/imu.c"
 $51 = ((($50)) + 56|0); //@line 29 "../../src/imu/imu.c"
 HEAPF64[$51>>3] = 0.0; //@line 29 "../../src/imu/imu.c"
 $52 = $1; //@line 31 "../../src/imu/imu.c"
 $53 = ((($52)) + 40|0); //@line 31 "../../src/imu/imu.c"
 _vec3_10($9,0.0,0.0,1.0); //@line 31 "../../src/imu/imu.c"
 ;HEAP32[$53>>2]=HEAP32[$9>>2]|0;HEAP32[$53+4>>2]=HEAP32[$9+4>>2]|0;HEAP32[$53+8>>2]=HEAP32[$9+8>>2]|0; //@line 31 "../../src/imu/imu.c"
 $54 = $1; //@line 33 "../../src/imu/imu.c"
 $55 = ((($54)) + 1232|0); //@line 33 "../../src/imu/imu.c"
 HEAPF64[$55>>3] = 0.0; //@line 33 "../../src/imu/imu.c"
 $56 = $1; //@line 34 "../../src/imu/imu.c"
 $57 = ((($56)) + 1192|0); //@line 34 "../../src/imu/imu.c"
 _vec3_10($10,0.0,0.0,0.0); //@line 34 "../../src/imu/imu.c"
 ;HEAP32[$57>>2]=HEAP32[$10>>2]|0;HEAP32[$57+4>>2]=HEAP32[$10+4>>2]|0;HEAP32[$57+8>>2]=HEAP32[$10+8>>2]|0; //@line 34 "../../src/imu/imu.c"
 $58 = $1; //@line 35 "../../src/imu/imu.c"
 $59 = ((($58)) + 1204|0); //@line 35 "../../src/imu/imu.c"
 _vec3_10($11,1.0,1.0,1.0); //@line 35 "../../src/imu/imu.c"
 ;HEAP32[$59>>2]=HEAP32[$11>>2]|0;HEAP32[$59+4>>2]=HEAP32[$11+4>>2]|0;HEAP32[$59+8>>2]=HEAP32[$11+8>>2]|0; //@line 35 "../../src/imu/imu.c"
 $60 = $1; //@line 36 "../../src/imu/imu.c"
 $61 = ((($60)) + 1216|0); //@line 36 "../../src/imu/imu.c"
 _vec3_10($12,0.0,0.0,0.0); //@line 36 "../../src/imu/imu.c"
 ;HEAP32[$61>>2]=HEAP32[$12>>2]|0;HEAP32[$61+4>>2]=HEAP32[$12+4>>2]|0;HEAP32[$61+8>>2]=HEAP32[$12+8>>2]|0; //@line 36 "../../src/imu/imu.c"
 $62 = $1; //@line 38 "../../src/imu/imu.c"
 $63 = ((($62)) + 1240|0); //@line 38 "../../src/imu/imu.c"
 _vec3_10($13,0.0,0.0,0.0); //@line 38 "../../src/imu/imu.c"
 ;HEAP32[$63>>2]=HEAP32[$13>>2]|0;HEAP32[$63+4>>2]=HEAP32[$13+4>>2]|0;HEAP32[$63+8>>2]=HEAP32[$13+8>>2]|0; //@line 38 "../../src/imu/imu.c"
 $64 = $1; //@line 39 "../../src/imu/imu.c"
 $65 = ((($64)) + 1252|0); //@line 39 "../../src/imu/imu.c"
 _vec3_10($14,1.0,1.0,1.0); //@line 39 "../../src/imu/imu.c"
 ;HEAP32[$65>>2]=HEAP32[$14>>2]|0;HEAP32[$65+4>>2]=HEAP32[$14+4>>2]|0;HEAP32[$65+8>>2]=HEAP32[$14+8>>2]|0; //@line 39 "../../src/imu/imu.c"
 $66 = $1; //@line 40 "../../src/imu/imu.c"
 $67 = ((($66)) + 1264|0); //@line 40 "../../src/imu/imu.c"
 _vec3_10($15,0.0,0.0,0.0); //@line 40 "../../src/imu/imu.c"
 ;HEAP32[$67>>2]=HEAP32[$15>>2]|0;HEAP32[$67+4>>2]=HEAP32[$15+4>>2]|0;HEAP32[$67+8>>2]=HEAP32[$15+8>>2]|0; //@line 40 "../../src/imu/imu.c"
 $68 = $1; //@line 41 "../../src/imu/imu.c"
 $69 = ((($68)) + 32|0); //@line 41 "../../src/imu/imu.c"
 HEAPF64[$69>>3] = 0.0012199999999999999; //@line 41 "../../src/imu/imu.c"
 $70 = $1; //@line 43 "../../src/imu/imu.c"
 $71 = ((($70)) + 1504|0); //@line 43 "../../src/imu/imu.c"
 HEAPF64[$71>>3] = 0.0; //@line 43 "../../src/imu/imu.c"
 STACKTOP = sp;return; //@line 44 "../../src/imu/imu.c"
}
function _vec3_10($0,$1,$2,$3) {
 $0 = $0|0;
 $1 = +$1;
 $2 = +$2;
 $3 = +$3;
 var $10 = 0, $11 = 0.0, $4 = 0.0, $5 = 0.0, $6 = 0.0, $7 = 0.0, $8 = 0, $9 = 0.0, label = 0, sp = 0;
 sp = STACKTOP;
 STACKTOP = STACKTOP + 16|0; if ((STACKTOP|0) >= (STACK_MAX|0)) abortStackOverflow(16|0);
 $4 = $1;
 $5 = $2;
 $6 = $3;
 $7 = $4; //@line 100 "../../src/imu/../quaternion/../math3d/math_3d.h"
 HEAPF32[$0>>2] = $7; //@line 100 "../../src/imu/../quaternion/../math3d/math_3d.h"
 $8 = ((($0)) + 4|0); //@line 100 "../../src/imu/../quaternion/../math3d/math_3d.h"
 $9 = $5; //@line 100 "../../src/imu/../quaternion/../math3d/math_3d.h"
 HEAPF32[$8>>2] = $9; //@line 100 "../../src/imu/../quaternion/../math3d/math_3d.h"
 $10 = ((($0)) + 8|0); //@line 100 "../../src/imu/../quaternion/../math3d/math_3d.h"
 $11 = $6; //@line 100 "../../src/imu/../quaternion/../math3d/math_3d.h"
 HEAPF32[$10>>2] = $11; //@line 100 "../../src/imu/../quaternion/../math3d/math_3d.h"
 STACKTOP = sp;return; //@line 100 "../../src/imu/../quaternion/../math3d/math_3d.h"
}
function _propogate_gyro($0,$1,$2) {
 $0 = $0|0;
 $1 = $1|0;
 $2 = +$2;
 var $$byval_copy = 0, $$byval_copy1 = 0, $$byval_copy10 = 0, $$byval_copy11 = 0, $$byval_copy2 = 0, $$byval_copy3 = 0, $$byval_copy4 = 0, $$byval_copy5 = 0, $$byval_copy6 = 0, $$byval_copy7 = 0, $$byval_copy8 = 0, $$byval_copy9 = 0, $10 = 0, $11 = 0.0, $12 = 0.0, $13 = 0.0, $14 = 0.0, $15 = 0.0, $16 = 0, $17 = 0;
 var $18 = 0, $19 = 0, $20 = 0, $21 = 0, $22 = 0.0, $23 = 0, $24 = 0.0, $25 = 0, $26 = 0, $27 = 0, $28 = 0, $29 = 0.0, $3 = 0, $30 = 0, $31 = 0, $32 = 0, $33 = 0, $34 = 0, $35 = 0, $36 = 0;
 var $37 = 0, $38 = 0, $39 = 0.0, $4 = 0, $40 = 0.0, $41 = 0, $42 = 0, $43 = 0.0, $44 = 0, $45 = 0, $46 = 0.0, $47 = 0.0, $48 = 0.0, $49 = 0.0, $5 = 0.0, $50 = 0.0, $51 = 0, $52 = 0, $53 = 0.0, $54 = 0.0;
 var $55 = 0, $56 = 0.0, $57 = 0.0, $58 = 0.0, $59 = 0.0, $6 = 0, $60 = 0.0, $61 = 0.0, $62 = 0.0, $63 = 0.0, $64 = 0.0, $65 = 0.0, $66 = 0.0, $67 = 0.0, $68 = 0.0, $69 = 0.0, $7 = 0, $70 = 0.0, $71 = 0.0, $72 = 0.0;
 var $73 = 0, $74 = 0.0, $75 = 0.0, $76 = 0, $77 = 0.0, $78 = 0.0, $79 = 0.0, $8 = 0, $80 = 0, $81 = 0, $82 = 0, $83 = 0, $9 = 0, label = 0, sp = 0;
 sp = STACKTOP;
 STACKTOP = STACKTOP + 336|0; if ((STACKTOP|0) >= (STACK_MAX|0)) abortStackOverflow(336|0);
 $$byval_copy11 = sp + 312|0;
 $$byval_copy10 = sp + 296|0;
 $$byval_copy9 = sp + 280|0;
 $$byval_copy8 = sp + 268|0;
 $$byval_copy7 = sp + 256|0;
 $$byval_copy6 = sp + 240|0;
 $$byval_copy5 = sp + 228|0;
 $$byval_copy4 = sp + 216|0;
 $$byval_copy3 = sp + 204|0;
 $$byval_copy2 = sp + 192|0;
 $$byval_copy1 = sp + 180|0;
 $$byval_copy = sp + 168|0;
 $6 = sp + 148|0;
 $7 = sp + 136|0;
 $8 = sp + 124|0;
 $9 = sp + 112|0;
 $10 = sp + 96|0;
 $16 = sp + 56|0;
 $17 = sp + 40|0;
 $18 = sp + 24|0;
 $19 = sp + 8|0;
 $3 = $0;
 $4 = $1;
 $5 = $2;
 $20 = $4; //@line 48 "../../src/imu/imu.c"
 $21 = ((($20)) + 56|0); //@line 48 "../../src/imu/imu.c"
 $22 = +HEAPF64[$21>>3]; //@line 48 "../../src/imu/imu.c"
 $23 = $22 == 0.0; //@line 48 "../../src/imu/imu.c"
 if ($23) {
  $24 = $5; //@line 50 "../../src/imu/imu.c"
  $25 = $4; //@line 50 "../../src/imu/imu.c"
  $26 = ((($25)) + 56|0); //@line 50 "../../src/imu/imu.c"
  HEAPF64[$26>>3] = $24; //@line 50 "../../src/imu/imu.c"
  STACKTOP = sp;return; //@line 81 "../../src/imu/imu.c"
 }
 $27 = $3; //@line 54 "../../src/imu/imu.c"
 $28 = ((($27)) + 8|0); //@line 54 "../../src/imu/imu.c"
 $29 = +HEAPF64[$28>>3]; //@line 54 "../../src/imu/imu.c"
 $30 = $29 != 0.0; //@line 54 "../../src/imu/imu.c"
 if (!($30)) {
  STACKTOP = sp;return; //@line 81 "../../src/imu/imu.c"
 }
 $31 = $3; //@line 56 "../../src/imu/imu.c"
 $32 = ((($31)) + 1252|0); //@line 56 "../../src/imu/imu.c"
 $33 = $3; //@line 56 "../../src/imu/imu.c"
 $34 = ((($33)) + 16|0); //@line 56 "../../src/imu/imu.c"
 $35 = $3; //@line 56 "../../src/imu/imu.c"
 $36 = ((($35)) + 1240|0); //@line 56 "../../src/imu/imu.c"
 ;HEAP32[$$byval_copy>>2]=HEAP32[$34>>2]|0;HEAP32[$$byval_copy+4>>2]=HEAP32[$34+4>>2]|0;HEAP32[$$byval_copy+8>>2]=HEAP32[$34+8>>2]|0; //@line 56 "../../src/imu/imu.c"
 ;HEAP32[$$byval_copy1>>2]=HEAP32[$36>>2]|0;HEAP32[$$byval_copy1+4>>2]=HEAP32[$36+4>>2]|0;HEAP32[$$byval_copy1+8>>2]=HEAP32[$36+8>>2]|0; //@line 56 "../../src/imu/imu.c"
 _v3_sub_11($7,$$byval_copy,$$byval_copy1); //@line 56 "../../src/imu/imu.c"
 ;HEAP32[$$byval_copy2>>2]=HEAP32[$32>>2]|0;HEAP32[$$byval_copy2+4>>2]=HEAP32[$32+4>>2]|0;HEAP32[$$byval_copy2+8>>2]=HEAP32[$32+8>>2]|0; //@line 56 "../../src/imu/imu.c"
 ;HEAP32[$$byval_copy3>>2]=HEAP32[$7>>2]|0;HEAP32[$$byval_copy3+4>>2]=HEAP32[$7+4>>2]|0;HEAP32[$$byval_copy3+8>>2]=HEAP32[$7+8>>2]|0; //@line 56 "../../src/imu/imu.c"
 _v3_mul($6,$$byval_copy2,$$byval_copy3); //@line 56 "../../src/imu/imu.c"
 $37 = $3; //@line 57 "../../src/imu/imu.c"
 $38 = ((($37)) + 32|0); //@line 57 "../../src/imu/imu.c"
 $39 = +HEAPF64[$38>>3]; //@line 57 "../../src/imu/imu.c"
 $40 = $39; //@line 57 "../../src/imu/imu.c"
 ;HEAP32[$$byval_copy4>>2]=HEAP32[$6>>2]|0;HEAP32[$$byval_copy4+4>>2]=HEAP32[$6+4>>2]|0;HEAP32[$$byval_copy4+8>>2]=HEAP32[$6+8>>2]|0; //@line 57 "../../src/imu/imu.c"
 _v3_muls_12($8,$$byval_copy4,$40); //@line 57 "../../src/imu/imu.c"
 $41 = $3; //@line 59 "../../src/imu/imu.c"
 $42 = ((($41)) + 1264|0); //@line 59 "../../src/imu/imu.c"
 ;HEAP32[$$byval_copy5>>2]=HEAP32[$42>>2]|0;HEAP32[$$byval_copy5+4>>2]=HEAP32[$42+4>>2]|0;HEAP32[$$byval_copy5+8>>2]=HEAP32[$42+8>>2]|0; //@line 59 "../../src/imu/imu.c"
 _quaternion_from_hpr($10,$$byval_copy5); //@line 59 "../../src/imu/imu.c"
 ;HEAP32[$$byval_copy6>>2]=HEAP32[$10>>2]|0;HEAP32[$$byval_copy6+4>>2]=HEAP32[$10+4>>2]|0;HEAP32[$$byval_copy6+8>>2]=HEAP32[$10+8>>2]|0;HEAP32[$$byval_copy6+12>>2]=HEAP32[$10+12>>2]|0; //@line 59 "../../src/imu/imu.c"
 ;HEAP32[$$byval_copy7>>2]=HEAP32[$8>>2]|0;HEAP32[$$byval_copy7+4>>2]=HEAP32[$8+4>>2]|0;HEAP32[$$byval_copy7+8>>2]=HEAP32[$8+8>>2]|0; //@line 59 "../../src/imu/imu.c"
 _quaternion_rotate_vec3($$byval_copy6,$$byval_copy7,$9); //@line 59 "../../src/imu/imu.c"
 $43 = $5; //@line 61 "../../src/imu/imu.c"
 $44 = $4; //@line 61 "../../src/imu/imu.c"
 $45 = ((($44)) + 56|0); //@line 61 "../../src/imu/imu.c"
 $46 = +HEAPF64[$45>>3]; //@line 61 "../../src/imu/imu.c"
 $47 = $43 - $46; //@line 61 "../../src/imu/imu.c"
 $48 = 0.001 * $47; //@line 61 "../../src/imu/imu.c"
 $49 = $48; //@line 61 "../../src/imu/imu.c"
 $11 = $49; //@line 61 "../../src/imu/imu.c"
 $50 = $5; //@line 62 "../../src/imu/imu.c"
 $51 = $4; //@line 62 "../../src/imu/imu.c"
 $52 = ((($51)) + 56|0); //@line 62 "../../src/imu/imu.c"
 HEAPF64[$52>>3] = $50; //@line 62 "../../src/imu/imu.c"
 ;HEAP32[$$byval_copy8>>2]=HEAP32[$9>>2]|0;HEAP32[$$byval_copy8+4>>2]=HEAP32[$9+4>>2]|0;HEAP32[$$byval_copy8+8>>2]=HEAP32[$9+8>>2]|0; //@line 64 "../../src/imu/imu.c"
 $53 = (+_v3_length_13($$byval_copy8)); //@line 64 "../../src/imu/imu.c"
 $12 = $53; //@line 64 "../../src/imu/imu.c"
 $13 = 0.0; //@line 65 "../../src/imu/imu.c"
 $14 = 0.0; //@line 65 "../../src/imu/imu.c"
 $15 = 1.0; //@line 65 "../../src/imu/imu.c"
 _quaternion($16,0.0,0.0,0.0,1.0); //@line 66 "../../src/imu/imu.c"
 $54 = $12; //@line 67 "../../src/imu/imu.c"
 $55 = $54 > 0.0; //@line 67 "../../src/imu/imu.c"
 if ($55) {
  $56 = $12; //@line 69 "../../src/imu/imu.c"
  $57 = $11; //@line 69 "../../src/imu/imu.c"
  $58 = $56 * $57; //@line 69 "../../src/imu/imu.c"
  $13 = $58; //@line 69 "../../src/imu/imu.c"
  $59 = $13; //@line 70 "../../src/imu/imu.c"
  $60 = $59; //@line 70 "../../src/imu/imu.c"
  $61 = $60 / 2.0; //@line 70 "../../src/imu/imu.c"
  $62 = (+Math_sin((+$61))); //@line 70 "../../src/imu/imu.c"
  $63 = $62; //@line 70 "../../src/imu/imu.c"
  $14 = $63; //@line 70 "../../src/imu/imu.c"
  $64 = $13; //@line 71 "../../src/imu/imu.c"
  $65 = $64; //@line 71 "../../src/imu/imu.c"
  $66 = $65 / 2.0; //@line 71 "../../src/imu/imu.c"
  $67 = (+Math_cos((+$66))); //@line 71 "../../src/imu/imu.c"
  $68 = $67; //@line 71 "../../src/imu/imu.c"
  $15 = $68; //@line 71 "../../src/imu/imu.c"
  $69 = $14; //@line 73 "../../src/imu/imu.c"
  $70 = $12; //@line 73 "../../src/imu/imu.c"
  $71 = $69 / $70; //@line 73 "../../src/imu/imu.c"
  ;HEAP32[$$byval_copy9>>2]=HEAP32[$9>>2]|0;HEAP32[$$byval_copy9+4>>2]=HEAP32[$9+4>>2]|0;HEAP32[$$byval_copy9+8>>2]=HEAP32[$9+8>>2]|0; //@line 73 "../../src/imu/imu.c"
  _v3_muls_12($17,$$byval_copy9,$71); //@line 73 "../../src/imu/imu.c"
  $72 = +HEAPF32[$17>>2]; //@line 75 "../../src/imu/imu.c"
  $73 = ((($17)) + 4|0); //@line 75 "../../src/imu/imu.c"
  $74 = +HEAPF32[$73>>2]; //@line 75 "../../src/imu/imu.c"
  $75 = - $74; //@line 75 "../../src/imu/imu.c"
  $76 = ((($17)) + 8|0); //@line 75 "../../src/imu/imu.c"
  $77 = +HEAPF32[$76>>2]; //@line 75 "../../src/imu/imu.c"
  $78 = - $77; //@line 75 "../../src/imu/imu.c"
  $79 = $15; //@line 75 "../../src/imu/imu.c"
  _quaternion($18,$72,$75,$78,$79); //@line 75 "../../src/imu/imu.c"
  ;HEAP32[$16>>2]=HEAP32[$18>>2]|0;HEAP32[$16+4>>2]=HEAP32[$18+4>>2]|0;HEAP32[$16+8>>2]=HEAP32[$18+8>>2]|0;HEAP32[$16+12>>2]=HEAP32[$18+12>>2]|0; //@line 75 "../../src/imu/imu.c"
 }
 $80 = $4; //@line 78 "../../src/imu/imu.c"
 $81 = ((($80)) + 24|0); //@line 78 "../../src/imu/imu.c"
 $82 = $4; //@line 78 "../../src/imu/imu.c"
 $83 = ((($82)) + 24|0); //@line 78 "../../src/imu/imu.c"
 ;HEAP32[$$byval_copy10>>2]=HEAP32[$83>>2]|0;HEAP32[$$byval_copy10+4>>2]=HEAP32[$83+4>>2]|0;HEAP32[$$byval_copy10+8>>2]=HEAP32[$83+8>>2]|0;HEAP32[$$byval_copy10+12>>2]=HEAP32[$83+12>>2]|0; //@line 78 "../../src/imu/imu.c"
 ;HEAP32[$$byval_copy11>>2]=HEAP32[$16>>2]|0;HEAP32[$$byval_copy11+4>>2]=HEAP32[$16+4>>2]|0;HEAP32[$$byval_copy11+8>>2]=HEAP32[$16+8>>2]|0;HEAP32[$$byval_copy11+12>>2]=HEAP32[$16+12>>2]|0; //@line 78 "../../src/imu/imu.c"
 _quaternion_multiply_14($19,$$byval_copy10,$$byval_copy11); //@line 78 "../../src/imu/imu.c"
 ;HEAP32[$81>>2]=HEAP32[$19>>2]|0;HEAP32[$81+4>>2]=HEAP32[$19+4>>2]|0;HEAP32[$81+8>>2]=HEAP32[$19+8>>2]|0;HEAP32[$81+12>>2]=HEAP32[$19+12>>2]|0; //@line 78 "../../src/imu/imu.c"
 STACKTOP = sp;return; //@line 81 "../../src/imu/imu.c"
}
function _v3_sub_11($0,$1,$2) {
 $0 = $0|0;
 $1 = $1|0;
 $2 = $2|0;
 var $10 = 0.0, $11 = 0.0, $12 = 0, $13 = 0, $14 = 0.0, $15 = 0, $16 = 0.0, $17 = 0.0, $3 = 0.0, $4 = 0.0, $5 = 0.0, $6 = 0, $7 = 0, $8 = 0.0, $9 = 0, label = 0, sp = 0;
 sp = STACKTOP;
 $3 = +HEAPF32[$1>>2]; //@line 104 "../../src/imu/../quaternion/../math3d/math_3d.h"
 $4 = +HEAPF32[$2>>2]; //@line 104 "../../src/imu/../quaternion/../math3d/math_3d.h"
 $5 = $3 - $4; //@line 104 "../../src/imu/../quaternion/../math3d/math_3d.h"
 HEAPF32[$0>>2] = $5; //@line 104 "../../src/imu/../quaternion/../math3d/math_3d.h"
 $6 = ((($0)) + 4|0); //@line 104 "../../src/imu/../quaternion/../math3d/math_3d.h"
 $7 = ((($1)) + 4|0); //@line 104 "../../src/imu/../quaternion/../math3d/math_3d.h"
 $8 = +HEAPF32[$7>>2]; //@line 104 "../../src/imu/../quaternion/../math3d/math_3d.h"
 $9 = ((($2)) + 4|0); //@line 104 "../../src/imu/../quaternion/../math3d/math_3d.h"
 $10 = +HEAPF32[$9>>2]; //@line 104 "../../src/imu/../quaternion/../math3d/math_3d.h"
 $11 = $8 - $10; //@line 104 "../../src/imu/../quaternion/../math3d/math_3d.h"
 HEAPF32[$6>>2] = $11; //@line 104 "../../src/imu/../quaternion/../math3d/math_3d.h"
 $12 = ((($0)) + 8|0); //@line 104 "../../src/imu/../quaternion/../math3d/math_3d.h"
 $13 = ((($1)) + 8|0); //@line 104 "../../src/imu/../quaternion/../math3d/math_3d.h"
 $14 = +HEAPF32[$13>>2]; //@line 104 "../../src/imu/../quaternion/../math3d/math_3d.h"
 $15 = ((($2)) + 8|0); //@line 104 "../../src/imu/../quaternion/../math3d/math_3d.h"
 $16 = +HEAPF32[$15>>2]; //@line 104 "../../src/imu/../quaternion/../math3d/math_3d.h"
 $17 = $14 - $16; //@line 104 "../../src/imu/../quaternion/../math3d/math_3d.h"
 HEAPF32[$12>>2] = $17; //@line 104 "../../src/imu/../quaternion/../math3d/math_3d.h"
 return; //@line 104 "../../src/imu/../quaternion/../math3d/math_3d.h"
}
function _v3_mul($0,$1,$2) {
 $0 = $0|0;
 $1 = $1|0;
 $2 = $2|0;
 var $10 = 0.0, $11 = 0.0, $12 = 0, $13 = 0, $14 = 0.0, $15 = 0, $16 = 0.0, $17 = 0.0, $3 = 0.0, $4 = 0.0, $5 = 0.0, $6 = 0, $7 = 0, $8 = 0.0, $9 = 0, label = 0, sp = 0;
 sp = STACKTOP;
 $3 = +HEAPF32[$1>>2]; //@line 106 "../../src/imu/../quaternion/../math3d/math_3d.h"
 $4 = +HEAPF32[$2>>2]; //@line 106 "../../src/imu/../quaternion/../math3d/math_3d.h"
 $5 = $3 * $4; //@line 106 "../../src/imu/../quaternion/../math3d/math_3d.h"
 HEAPF32[$0>>2] = $5; //@line 106 "../../src/imu/../quaternion/../math3d/math_3d.h"
 $6 = ((($0)) + 4|0); //@line 106 "../../src/imu/../quaternion/../math3d/math_3d.h"
 $7 = ((($1)) + 4|0); //@line 106 "../../src/imu/../quaternion/../math3d/math_3d.h"
 $8 = +HEAPF32[$7>>2]; //@line 106 "../../src/imu/../quaternion/../math3d/math_3d.h"
 $9 = ((($2)) + 4|0); //@line 106 "../../src/imu/../quaternion/../math3d/math_3d.h"
 $10 = +HEAPF32[$9>>2]; //@line 106 "../../src/imu/../quaternion/../math3d/math_3d.h"
 $11 = $8 * $10; //@line 106 "../../src/imu/../quaternion/../math3d/math_3d.h"
 HEAPF32[$6>>2] = $11; //@line 106 "../../src/imu/../quaternion/../math3d/math_3d.h"
 $12 = ((($0)) + 8|0); //@line 106 "../../src/imu/../quaternion/../math3d/math_3d.h"
 $13 = ((($1)) + 8|0); //@line 106 "../../src/imu/../quaternion/../math3d/math_3d.h"
 $14 = +HEAPF32[$13>>2]; //@line 106 "../../src/imu/../quaternion/../math3d/math_3d.h"
 $15 = ((($2)) + 8|0); //@line 106 "../../src/imu/../quaternion/../math3d/math_3d.h"
 $16 = +HEAPF32[$15>>2]; //@line 106 "../../src/imu/../quaternion/../math3d/math_3d.h"
 $17 = $14 * $16; //@line 106 "../../src/imu/../quaternion/../math3d/math_3d.h"
 HEAPF32[$12>>2] = $17; //@line 106 "../../src/imu/../quaternion/../math3d/math_3d.h"
 return; //@line 106 "../../src/imu/../quaternion/../math3d/math_3d.h"
}
function _v3_muls_12($0,$1,$2) {
 $0 = $0|0;
 $1 = $1|0;
 $2 = +$2;
 var $10 = 0.0, $11 = 0.0, $12 = 0, $13 = 0, $14 = 0.0, $15 = 0.0, $16 = 0.0, $3 = 0.0, $4 = 0.0, $5 = 0.0, $6 = 0.0, $7 = 0, $8 = 0, $9 = 0.0, label = 0, sp = 0;
 sp = STACKTOP;
 STACKTOP = STACKTOP + 16|0; if ((STACKTOP|0) >= (STACK_MAX|0)) abortStackOverflow(16|0);
 $3 = $2;
 $4 = +HEAPF32[$1>>2]; //@line 107 "../../src/imu/../quaternion/../math3d/math_3d.h"
 $5 = $3; //@line 107 "../../src/imu/../quaternion/../math3d/math_3d.h"
 $6 = $4 * $5; //@line 107 "../../src/imu/../quaternion/../math3d/math_3d.h"
 HEAPF32[$0>>2] = $6; //@line 107 "../../src/imu/../quaternion/../math3d/math_3d.h"
 $7 = ((($0)) + 4|0); //@line 107 "../../src/imu/../quaternion/../math3d/math_3d.h"
 $8 = ((($1)) + 4|0); //@line 107 "../../src/imu/../quaternion/../math3d/math_3d.h"
 $9 = +HEAPF32[$8>>2]; //@line 107 "../../src/imu/../quaternion/../math3d/math_3d.h"
 $10 = $3; //@line 107 "../../src/imu/../quaternion/../math3d/math_3d.h"
 $11 = $9 * $10; //@line 107 "../../src/imu/../quaternion/../math3d/math_3d.h"
 HEAPF32[$7>>2] = $11; //@line 107 "../../src/imu/../quaternion/../math3d/math_3d.h"
 $12 = ((($0)) + 8|0); //@line 107 "../../src/imu/../quaternion/../math3d/math_3d.h"
 $13 = ((($1)) + 8|0); //@line 107 "../../src/imu/../quaternion/../math3d/math_3d.h"
 $14 = +HEAPF32[$13>>2]; //@line 107 "../../src/imu/../quaternion/../math3d/math_3d.h"
 $15 = $3; //@line 107 "../../src/imu/../quaternion/../math3d/math_3d.h"
 $16 = $14 * $15; //@line 107 "../../src/imu/../quaternion/../math3d/math_3d.h"
 HEAPF32[$12>>2] = $16; //@line 107 "../../src/imu/../quaternion/../math3d/math_3d.h"
 STACKTOP = sp;return; //@line 107 "../../src/imu/../quaternion/../math3d/math_3d.h"
}
function _quaternion_from_hpr($0,$1) {
 $0 = $0|0;
 $1 = $1|0;
 var $2 = 0.0, $3 = 0, $4 = 0.0, $5 = 0, $6 = 0.0, label = 0, sp = 0;
 sp = STACKTOP;
 $2 = +HEAPF32[$1>>2]; //@line 260 "../../src/imu/imu.c"
 $3 = ((($1)) + 4|0); //@line 260 "../../src/imu/imu.c"
 $4 = +HEAPF32[$3>>2]; //@line 260 "../../src/imu/imu.c"
 $5 = ((($1)) + 8|0); //@line 260 "../../src/imu/imu.c"
 $6 = +HEAPF32[$5>>2]; //@line 260 "../../src/imu/imu.c"
 _quaternion_from_heading_pitch_roll($0,$2,$4,$6); //@line 260 "../../src/imu/imu.c"
 return; //@line 260 "../../src/imu/imu.c"
}
function _quaternion_rotate_vec3($0,$1,$2) {
 $0 = $0|0;
 $1 = $1|0;
 $2 = $2|0;
 var $$byval_copy = 0, $$byval_copy1 = 0, $10 = 0, $11 = 0, $12 = 0.0, $13 = 0, $14 = 0.0, $15 = 0, $16 = 0, $17 = 0.0, $18 = 0, $19 = 0, $20 = 0, $21 = 0.0, $22 = 0, $23 = 0, $3 = 0, $4 = 0, $5 = 0, $6 = 0;
 var $7 = 0.0, $8 = 0, $9 = 0.0, label = 0, sp = 0;
 sp = STACKTOP;
 STACKTOP = STACKTOP + 80|0; if ((STACKTOP|0) >= (STACK_MAX|0)) abortStackOverflow(80|0);
 $$byval_copy1 = sp + 56|0;
 $$byval_copy = sp + 40|0;
 $4 = sp + 24|0;
 $5 = sp + 12|0;
 $6 = sp;
 $3 = $2;
 $7 = +HEAPF32[$1>>2]; //@line 257 "../../src/imu/../quaternion/quaternion.h"
 HEAPF32[$5>>2] = $7; //@line 257 "../../src/imu/../quaternion/quaternion.h"
 $8 = ((($1)) + 4|0); //@line 258 "../../src/imu/../quaternion/quaternion.h"
 $9 = +HEAPF32[$8>>2]; //@line 258 "../../src/imu/../quaternion/quaternion.h"
 $10 = ((($5)) + 4|0); //@line 258 "../../src/imu/../quaternion/quaternion.h"
 HEAPF32[$10>>2] = $9; //@line 258 "../../src/imu/../quaternion/quaternion.h"
 $11 = ((($1)) + 8|0); //@line 259 "../../src/imu/../quaternion/quaternion.h"
 $12 = +HEAPF32[$11>>2]; //@line 259 "../../src/imu/../quaternion/quaternion.h"
 $13 = ((($5)) + 8|0); //@line 259 "../../src/imu/../quaternion/quaternion.h"
 HEAPF32[$13>>2] = $12; //@line 259 "../../src/imu/../quaternion/quaternion.h"
 ;HEAP32[$$byval_copy>>2]=HEAP32[$0>>2]|0;HEAP32[$$byval_copy+4>>2]=HEAP32[$0+4>>2]|0;HEAP32[$$byval_copy+8>>2]=HEAP32[$0+8>>2]|0;HEAP32[$$byval_copy+12>>2]=HEAP32[$0+12>>2]|0; //@line 260 "../../src/imu/../quaternion/quaternion.h"
 __sv_plus_rxv($$byval_copy,$5,$4); //@line 260 "../../src/imu/../quaternion/quaternion.h"
 ;HEAP32[$$byval_copy1>>2]=HEAP32[$0>>2]|0;HEAP32[$$byval_copy1+4>>2]=HEAP32[$0+4>>2]|0;HEAP32[$$byval_copy1+8>>2]=HEAP32[$0+8>>2]|0;HEAP32[$$byval_copy1+12>>2]=HEAP32[$0+12>>2]|0; //@line 261 "../../src/imu/../quaternion/quaternion.h"
 __v_plus_2rxvprime_over_m($$byval_copy1,$5,$4,2.0,$6); //@line 261 "../../src/imu/../quaternion/quaternion.h"
 $14 = +HEAPF32[$6>>2]; //@line 262 "../../src/imu/../quaternion/quaternion.h"
 $15 = $3; //@line 262 "../../src/imu/../quaternion/quaternion.h"
 HEAPF32[$15>>2] = $14; //@line 262 "../../src/imu/../quaternion/quaternion.h"
 $16 = ((($6)) + 4|0); //@line 263 "../../src/imu/../quaternion/quaternion.h"
 $17 = +HEAPF32[$16>>2]; //@line 263 "../../src/imu/../quaternion/quaternion.h"
 $18 = $3; //@line 263 "../../src/imu/../quaternion/quaternion.h"
 $19 = ((($18)) + 4|0); //@line 263 "../../src/imu/../quaternion/quaternion.h"
 HEAPF32[$19>>2] = $17; //@line 263 "../../src/imu/../quaternion/quaternion.h"
 $20 = ((($6)) + 8|0); //@line 264 "../../src/imu/../quaternion/quaternion.h"
 $21 = +HEAPF32[$20>>2]; //@line 264 "../../src/imu/../quaternion/quaternion.h"
 $22 = $3; //@line 264 "../../src/imu/../quaternion/quaternion.h"
 $23 = ((($22)) + 8|0); //@line 264 "../../src/imu/../quaternion/quaternion.h"
 HEAPF32[$23>>2] = $21; //@line 264 "../../src/imu/../quaternion/quaternion.h"
 STACKTOP = sp;return; //@line 265 "../../src/imu/../quaternion/quaternion.h"
}
function _v3_length_13($0) {
 $0 = $0|0;
 var $1 = 0.0, $10 = 0, $11 = 0.0, $12 = 0, $13 = 0.0, $14 = 0.0, $15 = 0.0, $16 = 0.0, $2 = 0.0, $3 = 0.0, $4 = 0, $5 = 0.0, $6 = 0, $7 = 0.0, $8 = 0.0, $9 = 0.0, label = 0, sp = 0;
 sp = STACKTOP;
 $1 = +HEAPF32[$0>>2]; //@line 110 "../../src/imu/../quaternion/../math3d/math_3d.h"
 $2 = +HEAPF32[$0>>2]; //@line 110 "../../src/imu/../quaternion/../math3d/math_3d.h"
 $3 = $1 * $2; //@line 110 "../../src/imu/../quaternion/../math3d/math_3d.h"
 $4 = ((($0)) + 4|0); //@line 110 "../../src/imu/../quaternion/../math3d/math_3d.h"
 $5 = +HEAPF32[$4>>2]; //@line 110 "../../src/imu/../quaternion/../math3d/math_3d.h"
 $6 = ((($0)) + 4|0); //@line 110 "../../src/imu/../quaternion/../math3d/math_3d.h"
 $7 = +HEAPF32[$6>>2]; //@line 110 "../../src/imu/../quaternion/../math3d/math_3d.h"
 $8 = $5 * $7; //@line 110 "../../src/imu/../quaternion/../math3d/math_3d.h"
 $9 = $3 + $8; //@line 110 "../../src/imu/../quaternion/../math3d/math_3d.h"
 $10 = ((($0)) + 8|0); //@line 110 "../../src/imu/../quaternion/../math3d/math_3d.h"
 $11 = +HEAPF32[$10>>2]; //@line 110 "../../src/imu/../quaternion/../math3d/math_3d.h"
 $12 = ((($0)) + 8|0); //@line 110 "../../src/imu/../quaternion/../math3d/math_3d.h"
 $13 = +HEAPF32[$12>>2]; //@line 110 "../../src/imu/../quaternion/../math3d/math_3d.h"
 $14 = $11 * $13; //@line 110 "../../src/imu/../quaternion/../math3d/math_3d.h"
 $15 = $9 + $14; //@line 110 "../../src/imu/../quaternion/../math3d/math_3d.h"
 $16 = (+Math_sqrt((+$15))); //@line 110 "../../src/imu/../quaternion/../math3d/math_3d.h"
 return (+$16); //@line 110 "../../src/imu/../quaternion/../math3d/math_3d.h"
}
function _quaternion_multiply_14($0,$1,$2) {
 $0 = $0|0;
 $1 = $1|0;
 $2 = $2|0;
 var $10 = 0.0, $11 = 0.0, $12 = 0.0, $13 = 0, $14 = 0.0, $15 = 0, $16 = 0.0, $17 = 0.0, $18 = 0.0, $19 = 0, $20 = 0.0, $21 = 0, $22 = 0.0, $23 = 0.0, $24 = 0.0, $25 = 0, $26 = 0.0, $27 = 0, $28 = 0.0, $29 = 0.0;
 var $3 = 0, $30 = 0, $31 = 0.0, $32 = 0.0, $33 = 0.0, $34 = 0.0, $35 = 0, $36 = 0.0, $37 = 0, $38 = 0.0, $39 = 0.0, $4 = 0.0, $40 = 0.0, $41 = 0, $42 = 0.0, $43 = 0, $44 = 0.0, $45 = 0.0, $46 = 0.0, $47 = 0;
 var $48 = 0.0, $49 = 0, $5 = 0.0, $50 = 0.0, $51 = 0.0, $52 = 0, $53 = 0.0, $54 = 0, $55 = 0.0, $56 = 0.0, $57 = 0.0, $58 = 0, $59 = 0.0, $6 = 0.0, $60 = 0.0, $61 = 0.0, $62 = 0.0, $63 = 0, $64 = 0.0, $65 = 0;
 var $66 = 0.0, $67 = 0.0, $68 = 0.0, $69 = 0, $7 = 0, $70 = 0.0, $71 = 0, $72 = 0.0, $73 = 0.0, $74 = 0, $75 = 0.0, $76 = 0, $77 = 0.0, $78 = 0.0, $79 = 0.0, $8 = 0.0, $80 = 0, $81 = 0.0, $82 = 0, $83 = 0.0;
 var $84 = 0.0, $85 = 0.0, $86 = 0, $87 = 0.0, $88 = 0.0, $89 = 0.0, $9 = 0, $90 = 0.0, label = 0, sp = 0;
 sp = STACKTOP;
 STACKTOP = STACKTOP + 16|0; if ((STACKTOP|0) >= (STACK_MAX|0)) abortStackOverflow(16|0);
 $3 = sp;
 $4 = +HEAPF32[$1>>2]; //@line 339 "../../src/imu/../quaternion/quaternion.h"
 $5 = +HEAPF32[$2>>2]; //@line 339 "../../src/imu/../quaternion/quaternion.h"
 $6 = $4 * $5; //@line 339 "../../src/imu/../quaternion/quaternion.h"
 $7 = ((($1)) + 4|0); //@line 339 "../../src/imu/../quaternion/quaternion.h"
 $8 = +HEAPF32[$7>>2]; //@line 339 "../../src/imu/../quaternion/quaternion.h"
 $9 = ((($2)) + 4|0); //@line 339 "../../src/imu/../quaternion/quaternion.h"
 $10 = +HEAPF32[$9>>2]; //@line 339 "../../src/imu/../quaternion/quaternion.h"
 $11 = $8 * $10; //@line 339 "../../src/imu/../quaternion/quaternion.h"
 $12 = $6 - $11; //@line 339 "../../src/imu/../quaternion/quaternion.h"
 $13 = ((($1)) + 8|0); //@line 339 "../../src/imu/../quaternion/quaternion.h"
 $14 = +HEAPF32[$13>>2]; //@line 339 "../../src/imu/../quaternion/quaternion.h"
 $15 = ((($2)) + 8|0); //@line 339 "../../src/imu/../quaternion/quaternion.h"
 $16 = +HEAPF32[$15>>2]; //@line 339 "../../src/imu/../quaternion/quaternion.h"
 $17 = $14 * $16; //@line 339 "../../src/imu/../quaternion/quaternion.h"
 $18 = $12 - $17; //@line 339 "../../src/imu/../quaternion/quaternion.h"
 $19 = ((($1)) + 12|0); //@line 339 "../../src/imu/../quaternion/quaternion.h"
 $20 = +HEAPF32[$19>>2]; //@line 339 "../../src/imu/../quaternion/quaternion.h"
 $21 = ((($2)) + 12|0); //@line 339 "../../src/imu/../quaternion/quaternion.h"
 $22 = +HEAPF32[$21>>2]; //@line 339 "../../src/imu/../quaternion/quaternion.h"
 $23 = $20 * $22; //@line 339 "../../src/imu/../quaternion/quaternion.h"
 $24 = $18 - $23; //@line 339 "../../src/imu/../quaternion/quaternion.h"
 HEAPF32[$3>>2] = $24; //@line 338 "../../src/imu/../quaternion/quaternion.h"
 $25 = ((($3)) + 4|0); //@line 338 "../../src/imu/../quaternion/quaternion.h"
 $26 = +HEAPF32[$1>>2]; //@line 340 "../../src/imu/../quaternion/quaternion.h"
 $27 = ((($2)) + 4|0); //@line 340 "../../src/imu/../quaternion/quaternion.h"
 $28 = +HEAPF32[$27>>2]; //@line 340 "../../src/imu/../quaternion/quaternion.h"
 $29 = $26 * $28; //@line 340 "../../src/imu/../quaternion/quaternion.h"
 $30 = ((($1)) + 4|0); //@line 340 "../../src/imu/../quaternion/quaternion.h"
 $31 = +HEAPF32[$30>>2]; //@line 340 "../../src/imu/../quaternion/quaternion.h"
 $32 = +HEAPF32[$2>>2]; //@line 340 "../../src/imu/../quaternion/quaternion.h"
 $33 = $31 * $32; //@line 340 "../../src/imu/../quaternion/quaternion.h"
 $34 = $29 + $33; //@line 340 "../../src/imu/../quaternion/quaternion.h"
 $35 = ((($1)) + 8|0); //@line 340 "../../src/imu/../quaternion/quaternion.h"
 $36 = +HEAPF32[$35>>2]; //@line 340 "../../src/imu/../quaternion/quaternion.h"
 $37 = ((($2)) + 12|0); //@line 340 "../../src/imu/../quaternion/quaternion.h"
 $38 = +HEAPF32[$37>>2]; //@line 340 "../../src/imu/../quaternion/quaternion.h"
 $39 = $36 * $38; //@line 340 "../../src/imu/../quaternion/quaternion.h"
 $40 = $34 + $39; //@line 340 "../../src/imu/../quaternion/quaternion.h"
 $41 = ((($1)) + 12|0); //@line 340 "../../src/imu/../quaternion/quaternion.h"
 $42 = +HEAPF32[$41>>2]; //@line 340 "../../src/imu/../quaternion/quaternion.h"
 $43 = ((($2)) + 8|0); //@line 340 "../../src/imu/../quaternion/quaternion.h"
 $44 = +HEAPF32[$43>>2]; //@line 340 "../../src/imu/../quaternion/quaternion.h"
 $45 = $42 * $44; //@line 340 "../../src/imu/../quaternion/quaternion.h"
 $46 = $40 - $45; //@line 340 "../../src/imu/../quaternion/quaternion.h"
 HEAPF32[$25>>2] = $46; //@line 338 "../../src/imu/../quaternion/quaternion.h"
 $47 = ((($3)) + 8|0); //@line 338 "../../src/imu/../quaternion/quaternion.h"
 $48 = +HEAPF32[$1>>2]; //@line 341 "../../src/imu/../quaternion/quaternion.h"
 $49 = ((($2)) + 8|0); //@line 341 "../../src/imu/../quaternion/quaternion.h"
 $50 = +HEAPF32[$49>>2]; //@line 341 "../../src/imu/../quaternion/quaternion.h"
 $51 = $48 * $50; //@line 341 "../../src/imu/../quaternion/quaternion.h"
 $52 = ((($1)) + 4|0); //@line 341 "../../src/imu/../quaternion/quaternion.h"
 $53 = +HEAPF32[$52>>2]; //@line 341 "../../src/imu/../quaternion/quaternion.h"
 $54 = ((($2)) + 12|0); //@line 341 "../../src/imu/../quaternion/quaternion.h"
 $55 = +HEAPF32[$54>>2]; //@line 341 "../../src/imu/../quaternion/quaternion.h"
 $56 = $53 * $55; //@line 341 "../../src/imu/../quaternion/quaternion.h"
 $57 = $51 - $56; //@line 341 "../../src/imu/../quaternion/quaternion.h"
 $58 = ((($1)) + 8|0); //@line 341 "../../src/imu/../quaternion/quaternion.h"
 $59 = +HEAPF32[$58>>2]; //@line 341 "../../src/imu/../quaternion/quaternion.h"
 $60 = +HEAPF32[$2>>2]; //@line 341 "../../src/imu/../quaternion/quaternion.h"
 $61 = $59 * $60; //@line 341 "../../src/imu/../quaternion/quaternion.h"
 $62 = $57 + $61; //@line 341 "../../src/imu/../quaternion/quaternion.h"
 $63 = ((($1)) + 12|0); //@line 341 "../../src/imu/../quaternion/quaternion.h"
 $64 = +HEAPF32[$63>>2]; //@line 341 "../../src/imu/../quaternion/quaternion.h"
 $65 = ((($2)) + 4|0); //@line 341 "../../src/imu/../quaternion/quaternion.h"
 $66 = +HEAPF32[$65>>2]; //@line 341 "../../src/imu/../quaternion/quaternion.h"
 $67 = $64 * $66; //@line 341 "../../src/imu/../quaternion/quaternion.h"
 $68 = $62 + $67; //@line 341 "../../src/imu/../quaternion/quaternion.h"
 HEAPF32[$47>>2] = $68; //@line 338 "../../src/imu/../quaternion/quaternion.h"
 $69 = ((($3)) + 12|0); //@line 338 "../../src/imu/../quaternion/quaternion.h"
 $70 = +HEAPF32[$1>>2]; //@line 342 "../../src/imu/../quaternion/quaternion.h"
 $71 = ((($2)) + 12|0); //@line 342 "../../src/imu/../quaternion/quaternion.h"
 $72 = +HEAPF32[$71>>2]; //@line 342 "../../src/imu/../quaternion/quaternion.h"
 $73 = $70 * $72; //@line 342 "../../src/imu/../quaternion/quaternion.h"
 $74 = ((($1)) + 4|0); //@line 342 "../../src/imu/../quaternion/quaternion.h"
 $75 = +HEAPF32[$74>>2]; //@line 342 "../../src/imu/../quaternion/quaternion.h"
 $76 = ((($2)) + 8|0); //@line 342 "../../src/imu/../quaternion/quaternion.h"
 $77 = +HEAPF32[$76>>2]; //@line 342 "../../src/imu/../quaternion/quaternion.h"
 $78 = $75 * $77; //@line 342 "../../src/imu/../quaternion/quaternion.h"
 $79 = $73 + $78; //@line 342 "../../src/imu/../quaternion/quaternion.h"
 $80 = ((($1)) + 8|0); //@line 342 "../../src/imu/../quaternion/quaternion.h"
 $81 = +HEAPF32[$80>>2]; //@line 342 "../../src/imu/../quaternion/quaternion.h"
 $82 = ((($2)) + 4|0); //@line 342 "../../src/imu/../quaternion/quaternion.h"
 $83 = +HEAPF32[$82>>2]; //@line 342 "../../src/imu/../quaternion/quaternion.h"
 $84 = $81 * $83; //@line 342 "../../src/imu/../quaternion/quaternion.h"
 $85 = $79 - $84; //@line 342 "../../src/imu/../quaternion/quaternion.h"
 $86 = ((($1)) + 12|0); //@line 342 "../../src/imu/../quaternion/quaternion.h"
 $87 = +HEAPF32[$86>>2]; //@line 342 "../../src/imu/../quaternion/quaternion.h"
 $88 = +HEAPF32[$2>>2]; //@line 342 "../../src/imu/../quaternion/quaternion.h"
 $89 = $87 * $88; //@line 342 "../../src/imu/../quaternion/quaternion.h"
 $90 = $85 + $89; //@line 342 "../../src/imu/../quaternion/quaternion.h"
 HEAPF32[$69>>2] = $90; //@line 338 "../../src/imu/../quaternion/quaternion.h"
 ;HEAP32[$0>>2]=HEAP32[$3>>2]|0;HEAP32[$0+4>>2]=HEAP32[$3+4>>2]|0;HEAP32[$0+8>>2]=HEAP32[$3+8>>2]|0;HEAP32[$0+12>>2]=HEAP32[$3+12>>2]|0; //@line 344 "../../src/imu/../quaternion/quaternion.h"
 STACKTOP = sp;return; //@line 344 "../../src/imu/../quaternion/quaternion.h"
}
function __sv_plus_rxv($0,$1,$2) {
 $0 = $0|0;
 $1 = $1|0;
 $2 = $2|0;
 var $10 = 0.0, $11 = 0, $12 = 0, $13 = 0.0, $14 = 0.0, $15 = 0.0, $16 = 0, $17 = 0.0, $18 = 0, $19 = 0, $20 = 0.0, $21 = 0.0, $22 = 0.0, $23 = 0, $24 = 0.0, $25 = 0, $26 = 0, $27 = 0.0, $28 = 0.0, $29 = 0;
 var $3 = 0, $30 = 0.0, $31 = 0, $32 = 0.0, $33 = 0.0, $34 = 0.0, $35 = 0, $36 = 0.0, $37 = 0, $38 = 0, $39 = 0.0, $4 = 0, $40 = 0.0, $41 = 0.0, $42 = 0, $43 = 0, $44 = 0.0, $45 = 0, $46 = 0, $47 = 0.0;
 var $48 = 0.0, $49 = 0, $5 = 0.0, $50 = 0.0, $51 = 0, $52 = 0, $53 = 0.0, $54 = 0.0, $55 = 0.0, $56 = 0, $57 = 0.0, $58 = 0, $59 = 0.0, $6 = 0, $60 = 0.0, $61 = 0.0, $62 = 0, $63 = 0, $7 = 0.0, $8 = 0.0;
 var $9 = 0, label = 0, sp = 0;
 sp = STACKTOP;
 STACKTOP = STACKTOP + 16|0; if ((STACKTOP|0) >= (STACK_MAX|0)) abortStackOverflow(16|0);
 $3 = $1;
 $4 = $2;
 $5 = +HEAPF32[$0>>2]; //@line 224 "../../src/imu/../quaternion/quaternion.h"
 $6 = $3; //@line 224 "../../src/imu/../quaternion/quaternion.h"
 $7 = +HEAPF32[$6>>2]; //@line 224 "../../src/imu/../quaternion/quaternion.h"
 $8 = $5 * $7; //@line 224 "../../src/imu/../quaternion/quaternion.h"
 $9 = ((($0)) + 8|0); //@line 224 "../../src/imu/../quaternion/quaternion.h"
 $10 = +HEAPF32[$9>>2]; //@line 224 "../../src/imu/../quaternion/quaternion.h"
 $11 = $3; //@line 224 "../../src/imu/../quaternion/quaternion.h"
 $12 = ((($11)) + 8|0); //@line 224 "../../src/imu/../quaternion/quaternion.h"
 $13 = +HEAPF32[$12>>2]; //@line 224 "../../src/imu/../quaternion/quaternion.h"
 $14 = $10 * $13; //@line 224 "../../src/imu/../quaternion/quaternion.h"
 $15 = $8 + $14; //@line 224 "../../src/imu/../quaternion/quaternion.h"
 $16 = ((($0)) + 12|0); //@line 224 "../../src/imu/../quaternion/quaternion.h"
 $17 = +HEAPF32[$16>>2]; //@line 224 "../../src/imu/../quaternion/quaternion.h"
 $18 = $3; //@line 224 "../../src/imu/../quaternion/quaternion.h"
 $19 = ((($18)) + 4|0); //@line 224 "../../src/imu/../quaternion/quaternion.h"
 $20 = +HEAPF32[$19>>2]; //@line 224 "../../src/imu/../quaternion/quaternion.h"
 $21 = $17 * $20; //@line 224 "../../src/imu/../quaternion/quaternion.h"
 $22 = $15 - $21; //@line 224 "../../src/imu/../quaternion/quaternion.h"
 $23 = $4; //@line 224 "../../src/imu/../quaternion/quaternion.h"
 HEAPF32[$23>>2] = $22; //@line 224 "../../src/imu/../quaternion/quaternion.h"
 $24 = +HEAPF32[$0>>2]; //@line 225 "../../src/imu/../quaternion/quaternion.h"
 $25 = $3; //@line 225 "../../src/imu/../quaternion/quaternion.h"
 $26 = ((($25)) + 4|0); //@line 225 "../../src/imu/../quaternion/quaternion.h"
 $27 = +HEAPF32[$26>>2]; //@line 225 "../../src/imu/../quaternion/quaternion.h"
 $28 = $24 * $27; //@line 225 "../../src/imu/../quaternion/quaternion.h"
 $29 = ((($0)) + 12|0); //@line 225 "../../src/imu/../quaternion/quaternion.h"
 $30 = +HEAPF32[$29>>2]; //@line 225 "../../src/imu/../quaternion/quaternion.h"
 $31 = $3; //@line 225 "../../src/imu/../quaternion/quaternion.h"
 $32 = +HEAPF32[$31>>2]; //@line 225 "../../src/imu/../quaternion/quaternion.h"
 $33 = $30 * $32; //@line 225 "../../src/imu/../quaternion/quaternion.h"
 $34 = $28 + $33; //@line 225 "../../src/imu/../quaternion/quaternion.h"
 $35 = ((($0)) + 4|0); //@line 225 "../../src/imu/../quaternion/quaternion.h"
 $36 = +HEAPF32[$35>>2]; //@line 225 "../../src/imu/../quaternion/quaternion.h"
 $37 = $3; //@line 225 "../../src/imu/../quaternion/quaternion.h"
 $38 = ((($37)) + 8|0); //@line 225 "../../src/imu/../quaternion/quaternion.h"
 $39 = +HEAPF32[$38>>2]; //@line 225 "../../src/imu/../quaternion/quaternion.h"
 $40 = $36 * $39; //@line 225 "../../src/imu/../quaternion/quaternion.h"
 $41 = $34 - $40; //@line 225 "../../src/imu/../quaternion/quaternion.h"
 $42 = $4; //@line 225 "../../src/imu/../quaternion/quaternion.h"
 $43 = ((($42)) + 4|0); //@line 225 "../../src/imu/../quaternion/quaternion.h"
 HEAPF32[$43>>2] = $41; //@line 225 "../../src/imu/../quaternion/quaternion.h"
 $44 = +HEAPF32[$0>>2]; //@line 226 "../../src/imu/../quaternion/quaternion.h"
 $45 = $3; //@line 226 "../../src/imu/../quaternion/quaternion.h"
 $46 = ((($45)) + 8|0); //@line 226 "../../src/imu/../quaternion/quaternion.h"
 $47 = +HEAPF32[$46>>2]; //@line 226 "../../src/imu/../quaternion/quaternion.h"
 $48 = $44 * $47; //@line 226 "../../src/imu/../quaternion/quaternion.h"
 $49 = ((($0)) + 4|0); //@line 226 "../../src/imu/../quaternion/quaternion.h"
 $50 = +HEAPF32[$49>>2]; //@line 226 "../../src/imu/../quaternion/quaternion.h"
 $51 = $3; //@line 226 "../../src/imu/../quaternion/quaternion.h"
 $52 = ((($51)) + 4|0); //@line 226 "../../src/imu/../quaternion/quaternion.h"
 $53 = +HEAPF32[$52>>2]; //@line 226 "../../src/imu/../quaternion/quaternion.h"
 $54 = $50 * $53; //@line 226 "../../src/imu/../quaternion/quaternion.h"
 $55 = $48 + $54; //@line 226 "../../src/imu/../quaternion/quaternion.h"
 $56 = ((($0)) + 8|0); //@line 226 "../../src/imu/../quaternion/quaternion.h"
 $57 = +HEAPF32[$56>>2]; //@line 226 "../../src/imu/../quaternion/quaternion.h"
 $58 = $3; //@line 226 "../../src/imu/../quaternion/quaternion.h"
 $59 = +HEAPF32[$58>>2]; //@line 226 "../../src/imu/../quaternion/quaternion.h"
 $60 = $57 * $59; //@line 226 "../../src/imu/../quaternion/quaternion.h"
 $61 = $55 - $60; //@line 226 "../../src/imu/../quaternion/quaternion.h"
 $62 = $4; //@line 226 "../../src/imu/../quaternion/quaternion.h"
 $63 = ((($62)) + 8|0); //@line 226 "../../src/imu/../quaternion/quaternion.h"
 HEAPF32[$63>>2] = $61; //@line 226 "../../src/imu/../quaternion/quaternion.h"
 STACKTOP = sp;return; //@line 227 "../../src/imu/../quaternion/quaternion.h"
}
function __v_plus_2rxvprime_over_m($0,$1,$2,$3,$4) {
 $0 = $0|0;
 $1 = $1|0;
 $2 = $2|0;
 $3 = +$3;
 $4 = $4|0;
 var $10 = 0.0, $11 = 0.0, $12 = 0, $13 = 0.0, $14 = 0, $15 = 0, $16 = 0.0, $17 = 0.0, $18 = 0, $19 = 0.0, $20 = 0, $21 = 0, $22 = 0.0, $23 = 0.0, $24 = 0.0, $25 = 0.0, $26 = 0.0, $27 = 0, $28 = 0, $29 = 0;
 var $30 = 0.0, $31 = 0.0, $32 = 0, $33 = 0.0, $34 = 0, $35 = 0.0, $36 = 0.0, $37 = 0, $38 = 0.0, $39 = 0, $40 = 0, $41 = 0.0, $42 = 0.0, $43 = 0.0, $44 = 0.0, $45 = 0.0, $46 = 0, $47 = 0, $48 = 0, $49 = 0;
 var $5 = 0, $50 = 0.0, $51 = 0.0, $52 = 0, $53 = 0.0, $54 = 0, $55 = 0, $56 = 0.0, $57 = 0.0, $58 = 0, $59 = 0.0, $6 = 0, $60 = 0, $61 = 0.0, $62 = 0.0, $63 = 0.0, $64 = 0.0, $65 = 0.0, $66 = 0, $67 = 0;
 var $7 = 0.0, $8 = 0, $9 = 0, label = 0, sp = 0;
 sp = STACKTOP;
 STACKTOP = STACKTOP + 16|0; if ((STACKTOP|0) >= (STACK_MAX|0)) abortStackOverflow(16|0);
 $5 = $1;
 $6 = $2;
 $7 = $3;
 $8 = $4;
 $9 = $5; //@line 230 "../../src/imu/../quaternion/quaternion.h"
 $10 = +HEAPF32[$9>>2]; //@line 230 "../../src/imu/../quaternion/quaternion.h"
 $11 = $7; //@line 230 "../../src/imu/../quaternion/quaternion.h"
 $12 = ((($0)) + 8|0); //@line 230 "../../src/imu/../quaternion/quaternion.h"
 $13 = +HEAPF32[$12>>2]; //@line 230 "../../src/imu/../quaternion/quaternion.h"
 $14 = $6; //@line 230 "../../src/imu/../quaternion/quaternion.h"
 $15 = ((($14)) + 8|0); //@line 230 "../../src/imu/../quaternion/quaternion.h"
 $16 = +HEAPF32[$15>>2]; //@line 230 "../../src/imu/../quaternion/quaternion.h"
 $17 = $13 * $16; //@line 230 "../../src/imu/../quaternion/quaternion.h"
 $18 = ((($0)) + 12|0); //@line 230 "../../src/imu/../quaternion/quaternion.h"
 $19 = +HEAPF32[$18>>2]; //@line 230 "../../src/imu/../quaternion/quaternion.h"
 $20 = $6; //@line 230 "../../src/imu/../quaternion/quaternion.h"
 $21 = ((($20)) + 4|0); //@line 230 "../../src/imu/../quaternion/quaternion.h"
 $22 = +HEAPF32[$21>>2]; //@line 230 "../../src/imu/../quaternion/quaternion.h"
 $23 = $19 * $22; //@line 230 "../../src/imu/../quaternion/quaternion.h"
 $24 = $17 - $23; //@line 230 "../../src/imu/../quaternion/quaternion.h"
 $25 = $11 * $24; //@line 230 "../../src/imu/../quaternion/quaternion.h"
 $26 = $10 + $25; //@line 230 "../../src/imu/../quaternion/quaternion.h"
 $27 = $8; //@line 230 "../../src/imu/../quaternion/quaternion.h"
 HEAPF32[$27>>2] = $26; //@line 230 "../../src/imu/../quaternion/quaternion.h"
 $28 = $5; //@line 231 "../../src/imu/../quaternion/quaternion.h"
 $29 = ((($28)) + 4|0); //@line 231 "../../src/imu/../quaternion/quaternion.h"
 $30 = +HEAPF32[$29>>2]; //@line 231 "../../src/imu/../quaternion/quaternion.h"
 $31 = $7; //@line 231 "../../src/imu/../quaternion/quaternion.h"
 $32 = ((($0)) + 12|0); //@line 231 "../../src/imu/../quaternion/quaternion.h"
 $33 = +HEAPF32[$32>>2]; //@line 231 "../../src/imu/../quaternion/quaternion.h"
 $34 = $6; //@line 231 "../../src/imu/../quaternion/quaternion.h"
 $35 = +HEAPF32[$34>>2]; //@line 231 "../../src/imu/../quaternion/quaternion.h"
 $36 = $33 * $35; //@line 231 "../../src/imu/../quaternion/quaternion.h"
 $37 = ((($0)) + 4|0); //@line 231 "../../src/imu/../quaternion/quaternion.h"
 $38 = +HEAPF32[$37>>2]; //@line 231 "../../src/imu/../quaternion/quaternion.h"
 $39 = $6; //@line 231 "../../src/imu/../quaternion/quaternion.h"
 $40 = ((($39)) + 8|0); //@line 231 "../../src/imu/../quaternion/quaternion.h"
 $41 = +HEAPF32[$40>>2]; //@line 231 "../../src/imu/../quaternion/quaternion.h"
 $42 = $38 * $41; //@line 231 "../../src/imu/../quaternion/quaternion.h"
 $43 = $36 - $42; //@line 231 "../../src/imu/../quaternion/quaternion.h"
 $44 = $31 * $43; //@line 231 "../../src/imu/../quaternion/quaternion.h"
 $45 = $30 + $44; //@line 231 "../../src/imu/../quaternion/quaternion.h"
 $46 = $8; //@line 231 "../../src/imu/../quaternion/quaternion.h"
 $47 = ((($46)) + 4|0); //@line 231 "../../src/imu/../quaternion/quaternion.h"
 HEAPF32[$47>>2] = $45; //@line 231 "../../src/imu/../quaternion/quaternion.h"
 $48 = $5; //@line 232 "../../src/imu/../quaternion/quaternion.h"
 $49 = ((($48)) + 8|0); //@line 232 "../../src/imu/../quaternion/quaternion.h"
 $50 = +HEAPF32[$49>>2]; //@line 232 "../../src/imu/../quaternion/quaternion.h"
 $51 = $7; //@line 232 "../../src/imu/../quaternion/quaternion.h"
 $52 = ((($0)) + 4|0); //@line 232 "../../src/imu/../quaternion/quaternion.h"
 $53 = +HEAPF32[$52>>2]; //@line 232 "../../src/imu/../quaternion/quaternion.h"
 $54 = $6; //@line 232 "../../src/imu/../quaternion/quaternion.h"
 $55 = ((($54)) + 4|0); //@line 232 "../../src/imu/../quaternion/quaternion.h"
 $56 = +HEAPF32[$55>>2]; //@line 232 "../../src/imu/../quaternion/quaternion.h"
 $57 = $53 * $56; //@line 232 "../../src/imu/../quaternion/quaternion.h"
 $58 = ((($0)) + 8|0); //@line 232 "../../src/imu/../quaternion/quaternion.h"
 $59 = +HEAPF32[$58>>2]; //@line 232 "../../src/imu/../quaternion/quaternion.h"
 $60 = $6; //@line 232 "../../src/imu/../quaternion/quaternion.h"
 $61 = +HEAPF32[$60>>2]; //@line 232 "../../src/imu/../quaternion/quaternion.h"
 $62 = $59 * $61; //@line 232 "../../src/imu/../quaternion/quaternion.h"
 $63 = $57 - $62; //@line 232 "../../src/imu/../quaternion/quaternion.h"
 $64 = $51 * $63; //@line 232 "../../src/imu/../quaternion/quaternion.h"
 $65 = $50 + $64; //@line 232 "../../src/imu/../quaternion/quaternion.h"
 $66 = $8; //@line 232 "../../src/imu/../quaternion/quaternion.h"
 $67 = ((($66)) + 8|0); //@line 232 "../../src/imu/../quaternion/quaternion.h"
 HEAPF32[$67>>2] = $65; //@line 232 "../../src/imu/../quaternion/quaternion.h"
 STACKTOP = sp;return; //@line 233 "../../src/imu/../quaternion/quaternion.h"
}
function _quaternion_from_heading_pitch_roll($0,$1,$2,$3) {
 $0 = $0|0;
 $1 = +$1;
 $2 = +$2;
 $3 = +$3;
 var $10 = 0.0, $11 = 0.0, $12 = 0.0, $13 = 0.0, $14 = 0.0, $15 = 0.0, $16 = 0.0, $17 = 0.0, $18 = 0.0, $19 = 0.0, $20 = 0.0, $21 = 0.0, $22 = 0.0, $23 = 0.0, $24 = 0.0, $25 = 0.0, $26 = 0.0, $27 = 0.0, $28 = 0.0, $29 = 0.0;
 var $30 = 0.0, $31 = 0.0, $32 = 0.0, $33 = 0.0, $34 = 0.0, $35 = 0.0, $36 = 0.0, $37 = 0.0, $38 = 0.0, $39 = 0.0, $4 = 0.0, $40 = 0.0, $41 = 0.0, $42 = 0.0, $43 = 0.0, $44 = 0.0, $45 = 0.0, $46 = 0.0, $47 = 0.0, $48 = 0.0;
 var $49 = 0.0, $5 = 0.0, $50 = 0.0, $51 = 0.0, $52 = 0.0, $53 = 0.0, $54 = 0.0, $55 = 0.0, $56 = 0.0, $57 = 0.0, $58 = 0.0, $59 = 0.0, $6 = 0.0, $60 = 0.0, $61 = 0.0, $62 = 0.0, $63 = 0.0, $64 = 0.0, $65 = 0.0, $66 = 0.0;
 var $67 = 0.0, $68 = 0.0, $69 = 0.0, $7 = 0.0, $70 = 0.0, $71 = 0.0, $72 = 0.0, $73 = 0.0, $74 = 0.0, $75 = 0.0, $76 = 0.0, $77 = 0.0, $78 = 0.0, $79 = 0.0, $8 = 0.0, $80 = 0.0, $81 = 0.0, $82 = 0.0, $83 = 0.0, $84 = 0.0;
 var $85 = 0.0, $86 = 0.0, $87 = 0.0, $88 = 0.0, $89 = 0.0, $9 = 0.0, $90 = 0.0, $91 = 0.0, $92 = 0.0, label = 0, sp = 0;
 sp = STACKTOP;
 STACKTOP = STACKTOP + 48|0; if ((STACKTOP|0) >= (STACK_MAX|0)) abortStackOverflow(48|0);
 $4 = $1;
 $5 = $2;
 $6 = $3;
 $13 = $4; //@line 244 "../../src/imu/imu.c"
 $14 = (+_degrees_to_radians($13)); //@line 244 "../../src/imu/imu.c"
 $15 = $14; //@line 244 "../../src/imu/imu.c"
 $16 = $15 / 2.0; //@line 244 "../../src/imu/imu.c"
 $17 = (+Math_cos((+$16))); //@line 244 "../../src/imu/imu.c"
 $18 = $17; //@line 244 "../../src/imu/imu.c"
 $7 = $18; //@line 244 "../../src/imu/imu.c"
 $19 = $4; //@line 245 "../../src/imu/imu.c"
 $20 = (+_degrees_to_radians($19)); //@line 245 "../../src/imu/imu.c"
 $21 = $20; //@line 245 "../../src/imu/imu.c"
 $22 = $21 / 2.0; //@line 245 "../../src/imu/imu.c"
 $23 = (+Math_sin((+$22))); //@line 245 "../../src/imu/imu.c"
 $24 = $23; //@line 245 "../../src/imu/imu.c"
 $8 = $24; //@line 245 "../../src/imu/imu.c"
 $25 = $5; //@line 246 "../../src/imu/imu.c"
 $26 = (+_degrees_to_radians($25)); //@line 246 "../../src/imu/imu.c"
 $27 = $26; //@line 246 "../../src/imu/imu.c"
 $28 = $27 / 2.0; //@line 246 "../../src/imu/imu.c"
 $29 = (+Math_cos((+$28))); //@line 246 "../../src/imu/imu.c"
 $30 = $29; //@line 246 "../../src/imu/imu.c"
 $9 = $30; //@line 246 "../../src/imu/imu.c"
 $31 = $5; //@line 247 "../../src/imu/imu.c"
 $32 = (+_degrees_to_radians($31)); //@line 247 "../../src/imu/imu.c"
 $33 = $32; //@line 247 "../../src/imu/imu.c"
 $34 = $33 / 2.0; //@line 247 "../../src/imu/imu.c"
 $35 = (+Math_sin((+$34))); //@line 247 "../../src/imu/imu.c"
 $36 = $35; //@line 247 "../../src/imu/imu.c"
 $10 = $36; //@line 247 "../../src/imu/imu.c"
 $37 = $6; //@line 248 "../../src/imu/imu.c"
 $38 = (+_degrees_to_radians($37)); //@line 248 "../../src/imu/imu.c"
 $39 = $38; //@line 248 "../../src/imu/imu.c"
 $40 = $39 / 2.0; //@line 248 "../../src/imu/imu.c"
 $41 = (+Math_cos((+$40))); //@line 248 "../../src/imu/imu.c"
 $42 = $41; //@line 248 "../../src/imu/imu.c"
 $11 = $42; //@line 248 "../../src/imu/imu.c"
 $43 = $6; //@line 249 "../../src/imu/imu.c"
 $44 = (+_degrees_to_radians($43)); //@line 249 "../../src/imu/imu.c"
 $45 = $44; //@line 249 "../../src/imu/imu.c"
 $46 = $45 / 2.0; //@line 249 "../../src/imu/imu.c"
 $47 = (+Math_sin((+$46))); //@line 249 "../../src/imu/imu.c"
 $48 = $47; //@line 249 "../../src/imu/imu.c"
 $12 = $48; //@line 249 "../../src/imu/imu.c"
 $49 = $7; //@line 252 "../../src/imu/imu.c"
 $50 = $9; //@line 252 "../../src/imu/imu.c"
 $51 = $49 * $50; //@line 252 "../../src/imu/imu.c"
 $52 = $12; //@line 252 "../../src/imu/imu.c"
 $53 = $51 * $52; //@line 252 "../../src/imu/imu.c"
 $54 = $8; //@line 252 "../../src/imu/imu.c"
 $55 = $10; //@line 252 "../../src/imu/imu.c"
 $56 = $54 * $55; //@line 252 "../../src/imu/imu.c"
 $57 = $11; //@line 252 "../../src/imu/imu.c"
 $58 = $56 * $57; //@line 252 "../../src/imu/imu.c"
 $59 = $53 - $58; //@line 252 "../../src/imu/imu.c"
 $60 = $7; //@line 253 "../../src/imu/imu.c"
 $61 = $10; //@line 253 "../../src/imu/imu.c"
 $62 = $60 * $61; //@line 253 "../../src/imu/imu.c"
 $63 = $11; //@line 253 "../../src/imu/imu.c"
 $64 = $62 * $63; //@line 253 "../../src/imu/imu.c"
 $65 = $8; //@line 253 "../../src/imu/imu.c"
 $66 = $9; //@line 253 "../../src/imu/imu.c"
 $67 = $65 * $66; //@line 253 "../../src/imu/imu.c"
 $68 = $12; //@line 253 "../../src/imu/imu.c"
 $69 = $67 * $68; //@line 253 "../../src/imu/imu.c"
 $70 = $64 + $69; //@line 253 "../../src/imu/imu.c"
 $71 = $8; //@line 254 "../../src/imu/imu.c"
 $72 = $9; //@line 254 "../../src/imu/imu.c"
 $73 = $71 * $72; //@line 254 "../../src/imu/imu.c"
 $74 = $11; //@line 254 "../../src/imu/imu.c"
 $75 = $73 * $74; //@line 254 "../../src/imu/imu.c"
 $76 = $7; //@line 254 "../../src/imu/imu.c"
 $77 = $10; //@line 254 "../../src/imu/imu.c"
 $78 = $76 * $77; //@line 254 "../../src/imu/imu.c"
 $79 = $12; //@line 254 "../../src/imu/imu.c"
 $80 = $78 * $79; //@line 254 "../../src/imu/imu.c"
 $81 = $75 - $80; //@line 254 "../../src/imu/imu.c"
 $82 = $7; //@line 255 "../../src/imu/imu.c"
 $83 = $9; //@line 255 "../../src/imu/imu.c"
 $84 = $82 * $83; //@line 255 "../../src/imu/imu.c"
 $85 = $11; //@line 255 "../../src/imu/imu.c"
 $86 = $84 * $85; //@line 255 "../../src/imu/imu.c"
 $87 = $8; //@line 255 "../../src/imu/imu.c"
 $88 = $10; //@line 255 "../../src/imu/imu.c"
 $89 = $87 * $88; //@line 255 "../../src/imu/imu.c"
 $90 = $12; //@line 255 "../../src/imu/imu.c"
 $91 = $89 * $90; //@line 255 "../../src/imu/imu.c"
 $92 = $86 + $91; //@line 255 "../../src/imu/imu.c"
 _quaternion($0,$59,$70,$81,$92); //@line 252 "../../src/imu/imu.c"
 STACKTOP = sp;return; //@line 252 "../../src/imu/imu.c"
}
function _degrees_to_radians($0) {
 $0 = +$0;
 var $1 = 0.0, $2 = 0.0, $3 = 0.0, $4 = 0.0, $5 = 0.0, label = 0, sp = 0;
 sp = STACKTOP;
 STACKTOP = STACKTOP + 16|0; if ((STACKTOP|0) >= (STACK_MAX|0)) abortStackOverflow(16|0);
 $1 = $0;
 $2 = $1; //@line 108 "../../src/imu/imu.c"
 $3 = $2; //@line 108 "../../src/imu/imu.c"
 $4 = 0.01745329252 * $3; //@line 108 "../../src/imu/imu.c"
 $5 = $4; //@line 108 "../../src/imu/imu.c"
 STACKTOP = sp;return (+$5); //@line 108 "../../src/imu/imu.c"
}
function _imu_update_gyro($0,$1,$2,$3) {
 $0 = $0|0;
 $1 = $1|0;
 $2 = $2|0;
 $3 = $3|0;
 var $10 = 0, $100 = 0, $101 = 0, $102 = 0.0, $103 = 0.0, $104 = 0, $105 = 0, $106 = 0, $107 = 0, $108 = 0, $109 = 0, $11 = 0, $110 = 0, $111 = 0, $112 = 0, $113 = 0, $114 = 0, $115 = 0, $116 = 0.0, $117 = 0.0;
 var $118 = 0, $119 = 0, $12 = 0.0, $120 = 0, $121 = 0, $122 = 0, $123 = 0, $124 = 0, $125 = 0, $126 = 0, $127 = 0, $128 = 0, $129 = 0, $13 = 0.0, $130 = 0.0, $131 = 0.0, $132 = 0, $133 = 0, $134 = 0, $135 = 0;
 var $136 = 0, $137 = 0, $138 = 0, $139 = 0, $14 = 0, $140 = 0, $141 = 0, $142 = 0, $143 = 0, $144 = 0, $145 = 0, $146 = 0, $147 = 0, $148 = 0, $15 = 0, $16 = 0.0, $17 = 0.0, $18 = 0, $19 = 0, $20 = 0.0;
 var $21 = 0.0, $22 = 0, $23 = 0, $24 = 0, $25 = 0.0, $26 = 0, $27 = 0, $28 = 0, $29 = 0.0, $30 = 0.0, $31 = 0, $32 = 0, $33 = 0.0, $34 = 0, $35 = 0, $36 = 0, $37 = 0, $38 = 0, $39 = 0, $4 = 0;
 var $40 = 0, $41 = 0, $42 = 0, $43 = 0, $44 = 0, $45 = 0, $46 = 0, $47 = 0.0, $48 = 0.0, $49 = 0, $5 = 0, $50 = 0, $51 = 0, $52 = 0, $53 = 0, $54 = 0, $55 = 0, $56 = 0, $57 = 0, $58 = 0;
 var $59 = 0, $6 = 0, $60 = 0, $61 = 0.0, $62 = 0.0, $63 = 0, $64 = 0, $65 = 0, $66 = 0, $67 = 0, $68 = 0, $69 = 0, $7 = 0, $70 = 0, $71 = 0, $72 = 0, $73 = 0, $74 = 0, $75 = 0.0, $76 = 0.0;
 var $77 = 0, $78 = 0, $79 = 0, $8 = 0, $80 = 0, $81 = 0, $82 = 0, $83 = 0, $84 = 0, $85 = 0, $86 = 0, $87 = 0, $88 = 0.0, $89 = 0.0, $9 = 0, $90 = 0, $91 = 0, $92 = 0, $93 = 0, $94 = 0;
 var $95 = 0, $96 = 0, $97 = 0, $98 = 0, $99 = 0, label = 0, sp = 0;
 sp = STACKTOP;
 STACKTOP = STACKTOP + 32|0; if ((STACKTOP|0) >= (STACK_MAX|0)) abortStackOverflow(32|0);
 $7 = sp + 4|0;
 $4 = $0;
 $5 = $2;
 $6 = $3;
 $9 = $4; //@line 86 "../../src/imu/imu.c"
 $10 = ((($9)) + 16|0); //@line 86 "../../src/imu/imu.c"
 $11 = ((($1)) + 16|0); //@line 86 "../../src/imu/imu.c"
 $12 = +HEAPF64[$11>>3]; //@line 86 "../../src/imu/imu.c"
 $13 = $12; //@line 86 "../../src/imu/imu.c"
 $14 = ((($1)) + 16|0); //@line 86 "../../src/imu/imu.c"
 $15 = ((($14)) + 8|0); //@line 86 "../../src/imu/imu.c"
 $16 = +HEAPF64[$15>>3]; //@line 86 "../../src/imu/imu.c"
 $17 = $16; //@line 86 "../../src/imu/imu.c"
 $18 = ((($1)) + 16|0); //@line 86 "../../src/imu/imu.c"
 $19 = ((($18)) + 16|0); //@line 86 "../../src/imu/imu.c"
 $20 = +HEAPF64[$19>>3]; //@line 86 "../../src/imu/imu.c"
 $21 = $20; //@line 86 "../../src/imu/imu.c"
 _vec3_10($7,$13,$17,$21); //@line 86 "../../src/imu/imu.c"
 ;HEAP32[$10>>2]=HEAP32[$7>>2]|0;HEAP32[$10+4>>2]=HEAP32[$7+4>>2]|0;HEAP32[$10+8>>2]=HEAP32[$7+8>>2]|0; //@line 86 "../../src/imu/imu.c"
 $22 = $4; //@line 87 "../../src/imu/imu.c"
 $23 = $4; //@line 87 "../../src/imu/imu.c"
 $24 = ((($23)) + 1376|0); //@line 87 "../../src/imu/imu.c"
 $25 = +HEAPF64[$1>>3]; //@line 87 "../../src/imu/imu.c"
 _propogate_gyro($22,$24,$25); //@line 87 "../../src/imu/imu.c"
 $26 = $4; //@line 88 "../../src/imu/imu.c"
 $27 = $4; //@line 88 "../../src/imu/imu.c"
 $28 = ((($27)) + 1312|0); //@line 88 "../../src/imu/imu.c"
 $29 = +HEAPF64[$1>>3]; //@line 88 "../../src/imu/imu.c"
 _propogate_gyro($26,$28,$29); //@line 88 "../../src/imu/imu.c"
 $30 = +HEAPF64[$1>>3]; //@line 89 "../../src/imu/imu.c"
 $31 = $4; //@line 89 "../../src/imu/imu.c"
 $32 = ((($31)) + 8|0); //@line 89 "../../src/imu/imu.c"
 HEAPF64[$32>>3] = $30; //@line 89 "../../src/imu/imu.c"
 $33 = +HEAPF64[$1>>3]; //@line 91 "../../src/imu/imu.c"
 $34 = $5; //@line 91 "../../src/imu/imu.c"
 $35 = $6; //@line 91 "../../src/imu/imu.c"
 $36 = HEAP32[$35>>2]|0; //@line 91 "../../src/imu/imu.c"
 $37 = (($34) + (($36*144)|0)|0); //@line 91 "../../src/imu/imu.c"
 HEAPF64[$37>>3] = $33; //@line 91 "../../src/imu/imu.c"
 $38 = $5; //@line 92 "../../src/imu/imu.c"
 $39 = $6; //@line 92 "../../src/imu/imu.c"
 $40 = HEAP32[$39>>2]|0; //@line 92 "../../src/imu/imu.c"
 $41 = (($38) + (($40*144)|0)|0); //@line 92 "../../src/imu/imu.c"
 $42 = ((($41)) + 8|0); //@line 92 "../../src/imu/imu.c"
 HEAP32[$42>>2] = 2000; //@line 92 "../../src/imu/imu.c"
 $8 = 0; //@line 93 "../../src/imu/imu.c"
 $43 = $4; //@line 94 "../../src/imu/imu.c"
 $44 = ((($43)) + 1312|0); //@line 94 "../../src/imu/imu.c"
 $45 = ((($44)) + 24|0); //@line 94 "../../src/imu/imu.c"
 $46 = ((($45)) + 4|0); //@line 94 "../../src/imu/imu.c"
 $47 = +HEAPF32[$46>>2]; //@line 94 "../../src/imu/imu.c"
 $48 = $47; //@line 94 "../../src/imu/imu.c"
 $49 = $5; //@line 94 "../../src/imu/imu.c"
 $50 = $6; //@line 94 "../../src/imu/imu.c"
 $51 = HEAP32[$50>>2]|0; //@line 94 "../../src/imu/imu.c"
 $52 = (($49) + (($51*144)|0)|0); //@line 94 "../../src/imu/imu.c"
 $53 = ((($52)) + 16|0); //@line 94 "../../src/imu/imu.c"
 $54 = $8; //@line 94 "../../src/imu/imu.c"
 $55 = (($54) + 1)|0; //@line 94 "../../src/imu/imu.c"
 $8 = $55; //@line 94 "../../src/imu/imu.c"
 $56 = (($53) + ($54<<3)|0); //@line 94 "../../src/imu/imu.c"
 HEAPF64[$56>>3] = $48; //@line 94 "../../src/imu/imu.c"
 $57 = $4; //@line 95 "../../src/imu/imu.c"
 $58 = ((($57)) + 1312|0); //@line 95 "../../src/imu/imu.c"
 $59 = ((($58)) + 24|0); //@line 95 "../../src/imu/imu.c"
 $60 = ((($59)) + 8|0); //@line 95 "../../src/imu/imu.c"
 $61 = +HEAPF32[$60>>2]; //@line 95 "../../src/imu/imu.c"
 $62 = $61; //@line 95 "../../src/imu/imu.c"
 $63 = $5; //@line 95 "../../src/imu/imu.c"
 $64 = $6; //@line 95 "../../src/imu/imu.c"
 $65 = HEAP32[$64>>2]|0; //@line 95 "../../src/imu/imu.c"
 $66 = (($63) + (($65*144)|0)|0); //@line 95 "../../src/imu/imu.c"
 $67 = ((($66)) + 16|0); //@line 95 "../../src/imu/imu.c"
 $68 = $8; //@line 95 "../../src/imu/imu.c"
 $69 = (($68) + 1)|0; //@line 95 "../../src/imu/imu.c"
 $8 = $69; //@line 95 "../../src/imu/imu.c"
 $70 = (($67) + ($68<<3)|0); //@line 95 "../../src/imu/imu.c"
 HEAPF64[$70>>3] = $62; //@line 95 "../../src/imu/imu.c"
 $71 = $4; //@line 96 "../../src/imu/imu.c"
 $72 = ((($71)) + 1312|0); //@line 96 "../../src/imu/imu.c"
 $73 = ((($72)) + 24|0); //@line 96 "../../src/imu/imu.c"
 $74 = ((($73)) + 12|0); //@line 96 "../../src/imu/imu.c"
 $75 = +HEAPF32[$74>>2]; //@line 96 "../../src/imu/imu.c"
 $76 = $75; //@line 96 "../../src/imu/imu.c"
 $77 = $5; //@line 96 "../../src/imu/imu.c"
 $78 = $6; //@line 96 "../../src/imu/imu.c"
 $79 = HEAP32[$78>>2]|0; //@line 96 "../../src/imu/imu.c"
 $80 = (($77) + (($79*144)|0)|0); //@line 96 "../../src/imu/imu.c"
 $81 = ((($80)) + 16|0); //@line 96 "../../src/imu/imu.c"
 $82 = $8; //@line 96 "../../src/imu/imu.c"
 $83 = (($82) + 1)|0; //@line 96 "../../src/imu/imu.c"
 $8 = $83; //@line 96 "../../src/imu/imu.c"
 $84 = (($81) + ($82<<3)|0); //@line 96 "../../src/imu/imu.c"
 HEAPF64[$84>>3] = $76; //@line 96 "../../src/imu/imu.c"
 $85 = $4; //@line 97 "../../src/imu/imu.c"
 $86 = ((($85)) + 1312|0); //@line 97 "../../src/imu/imu.c"
 $87 = ((($86)) + 24|0); //@line 97 "../../src/imu/imu.c"
 $88 = +HEAPF32[$87>>2]; //@line 97 "../../src/imu/imu.c"
 $89 = $88; //@line 97 "../../src/imu/imu.c"
 $90 = $5; //@line 97 "../../src/imu/imu.c"
 $91 = $6; //@line 97 "../../src/imu/imu.c"
 $92 = HEAP32[$91>>2]|0; //@line 97 "../../src/imu/imu.c"
 $93 = (($90) + (($92*144)|0)|0); //@line 97 "../../src/imu/imu.c"
 $94 = ((($93)) + 16|0); //@line 97 "../../src/imu/imu.c"
 $95 = $8; //@line 97 "../../src/imu/imu.c"
 $96 = (($95) + 1)|0; //@line 97 "../../src/imu/imu.c"
 $8 = $96; //@line 97 "../../src/imu/imu.c"
 $97 = (($94) + ($95<<3)|0); //@line 97 "../../src/imu/imu.c"
 HEAPF64[$97>>3] = $89; //@line 97 "../../src/imu/imu.c"
 $98 = $4; //@line 98 "../../src/imu/imu.c"
 $99 = ((($98)) + 1440|0); //@line 98 "../../src/imu/imu.c"
 $100 = ((($99)) + 24|0); //@line 98 "../../src/imu/imu.c"
 $101 = ((($100)) + 4|0); //@line 98 "../../src/imu/imu.c"
 $102 = +HEAPF32[$101>>2]; //@line 98 "../../src/imu/imu.c"
 $103 = $102; //@line 98 "../../src/imu/imu.c"
 $104 = $5; //@line 98 "../../src/imu/imu.c"
 $105 = $6; //@line 98 "../../src/imu/imu.c"
 $106 = HEAP32[$105>>2]|0; //@line 98 "../../src/imu/imu.c"
 $107 = (($104) + (($106*144)|0)|0); //@line 98 "../../src/imu/imu.c"
 $108 = ((($107)) + 16|0); //@line 98 "../../src/imu/imu.c"
 $109 = $8; //@line 98 "../../src/imu/imu.c"
 $110 = (($109) + 1)|0; //@line 98 "../../src/imu/imu.c"
 $8 = $110; //@line 98 "../../src/imu/imu.c"
 $111 = (($108) + ($109<<3)|0); //@line 98 "../../src/imu/imu.c"
 HEAPF64[$111>>3] = $103; //@line 98 "../../src/imu/imu.c"
 $112 = $4; //@line 99 "../../src/imu/imu.c"
 $113 = ((($112)) + 1440|0); //@line 99 "../../src/imu/imu.c"
 $114 = ((($113)) + 24|0); //@line 99 "../../src/imu/imu.c"
 $115 = ((($114)) + 8|0); //@line 99 "../../src/imu/imu.c"
 $116 = +HEAPF32[$115>>2]; //@line 99 "../../src/imu/imu.c"
 $117 = $116; //@line 99 "../../src/imu/imu.c"
 $118 = $5; //@line 99 "../../src/imu/imu.c"
 $119 = $6; //@line 99 "../../src/imu/imu.c"
 $120 = HEAP32[$119>>2]|0; //@line 99 "../../src/imu/imu.c"
 $121 = (($118) + (($120*144)|0)|0); //@line 99 "../../src/imu/imu.c"
 $122 = ((($121)) + 16|0); //@line 99 "../../src/imu/imu.c"
 $123 = $8; //@line 99 "../../src/imu/imu.c"
 $124 = (($123) + 1)|0; //@line 99 "../../src/imu/imu.c"
 $8 = $124; //@line 99 "../../src/imu/imu.c"
 $125 = (($122) + ($123<<3)|0); //@line 99 "../../src/imu/imu.c"
 HEAPF64[$125>>3] = $117; //@line 99 "../../src/imu/imu.c"
 $126 = $4; //@line 100 "../../src/imu/imu.c"
 $127 = ((($126)) + 1440|0); //@line 100 "../../src/imu/imu.c"
 $128 = ((($127)) + 24|0); //@line 100 "../../src/imu/imu.c"
 $129 = ((($128)) + 12|0); //@line 100 "../../src/imu/imu.c"
 $130 = +HEAPF32[$129>>2]; //@line 100 "../../src/imu/imu.c"
 $131 = $130; //@line 100 "../../src/imu/imu.c"
 $132 = $5; //@line 100 "../../src/imu/imu.c"
 $133 = $6; //@line 100 "../../src/imu/imu.c"
 $134 = HEAP32[$133>>2]|0; //@line 100 "../../src/imu/imu.c"
 $135 = (($132) + (($134*144)|0)|0); //@line 100 "../../src/imu/imu.c"
 $136 = ((($135)) + 16|0); //@line 100 "../../src/imu/imu.c"
 $137 = $8; //@line 100 "../../src/imu/imu.c"
 $138 = (($137) + 1)|0; //@line 100 "../../src/imu/imu.c"
 $8 = $138; //@line 100 "../../src/imu/imu.c"
 $139 = (($136) + ($137<<3)|0); //@line 100 "../../src/imu/imu.c"
 HEAPF64[$139>>3] = $131; //@line 100 "../../src/imu/imu.c"
 $140 = $8; //@line 102 "../../src/imu/imu.c"
 $141 = $5; //@line 102 "../../src/imu/imu.c"
 $142 = $6; //@line 102 "../../src/imu/imu.c"
 $143 = HEAP32[$142>>2]|0; //@line 102 "../../src/imu/imu.c"
 $144 = (($141) + (($143*144)|0)|0); //@line 102 "../../src/imu/imu.c"
 $145 = ((($144)) + 12|0); //@line 102 "../../src/imu/imu.c"
 HEAP32[$145>>2] = $140; //@line 102 "../../src/imu/imu.c"
 $146 = $6; //@line 103 "../../src/imu/imu.c"
 $147 = HEAP32[$146>>2]|0; //@line 103 "../../src/imu/imu.c"
 $148 = (($147) + 1)|0; //@line 103 "../../src/imu/imu.c"
 HEAP32[$146>>2] = $148; //@line 103 "../../src/imu/imu.c"
 STACKTOP = sp;return; //@line 104 "../../src/imu/imu.c"
}
function _radians_to_degrees($0) {
 $0 = +$0;
 var $1 = 0.0, $2 = 0.0, $3 = 0.0, $4 = 0.0, $5 = 0.0, label = 0, sp = 0;
 sp = STACKTOP;
 STACKTOP = STACKTOP + 16|0; if ((STACKTOP|0) >= (STACK_MAX|0)) abortStackOverflow(16|0);
 $1 = $0;
 $2 = $1; //@line 112 "../../src/imu/imu.c"
 $3 = $2; //@line 112 "../../src/imu/imu.c"
 $4 = 57.295779000000003 * $3; //@line 112 "../../src/imu/imu.c"
 $5 = $4; //@line 112 "../../src/imu/imu.c"
 STACKTOP = sp;return (+$5); //@line 112 "../../src/imu/imu.c"
}
function _imu_update_accelerometer($0,$1,$2,$3) {
 $0 = $0|0;
 $1 = $1|0;
 $2 = $2|0;
 $3 = $3|0;
 var $$byval_copy = 0, $10 = 0, $11 = 0, $12 = 0.0, $13 = 0.0, $14 = 0, $15 = 0, $16 = 0.0, $17 = 0.0, $18 = 0, $19 = 0, $20 = 0.0, $21 = 0.0, $4 = 0, $5 = 0, $6 = 0, $7 = 0, $8 = 0, $9 = 0, label = 0;
 var sp = 0;
 sp = STACKTOP;
 STACKTOP = STACKTOP + 48|0; if ((STACKTOP|0) >= (STACK_MAX|0)) abortStackOverflow(48|0);
 $$byval_copy = sp + 36|0;
 $7 = sp + 12|0;
 $8 = sp;
 $4 = $0;
 $5 = $2;
 $6 = $3;
 $9 = $4; //@line 117 "../../src/imu/imu.c"
 $10 = ((($9)) + 40|0); //@line 117 "../../src/imu/imu.c"
 $11 = ((($1)) + 16|0); //@line 117 "../../src/imu/imu.c"
 $12 = +HEAPF64[$11>>3]; //@line 117 "../../src/imu/imu.c"
 $13 = $12; //@line 117 "../../src/imu/imu.c"
 $14 = ((($1)) + 16|0); //@line 117 "../../src/imu/imu.c"
 $15 = ((($14)) + 8|0); //@line 117 "../../src/imu/imu.c"
 $16 = +HEAPF64[$15>>3]; //@line 117 "../../src/imu/imu.c"
 $17 = $16; //@line 117 "../../src/imu/imu.c"
 $18 = ((($1)) + 16|0); //@line 117 "../../src/imu/imu.c"
 $19 = ((($18)) + 16|0); //@line 117 "../../src/imu/imu.c"
 $20 = +HEAPF64[$19>>3]; //@line 117 "../../src/imu/imu.c"
 $21 = $20; //@line 117 "../../src/imu/imu.c"
 _vec3_10($7,$13,$17,$21); //@line 117 "../../src/imu/imu.c"
 ;HEAP32[$$byval_copy>>2]=HEAP32[$7>>2]|0;HEAP32[$$byval_copy+4>>2]=HEAP32[$7+4>>2]|0;HEAP32[$$byval_copy+8>>2]=HEAP32[$7+8>>2]|0; //@line 117 "../../src/imu/imu.c"
 _v3_norm_15($8,$$byval_copy); //@line 117 "../../src/imu/imu.c"
 ;HEAP32[$10>>2]=HEAP32[$8>>2]|0;HEAP32[$10+4>>2]=HEAP32[$8+4>>2]|0;HEAP32[$10+8>>2]=HEAP32[$8+8>>2]|0; //@line 117 "../../src/imu/imu.c"
 STACKTOP = sp;return; //@line 118 "../../src/imu/imu.c"
}
function _v3_norm_15($0,$1) {
 $0 = $0|0;
 $1 = $1|0;
 var $$byval_copy = 0, $10 = 0, $11 = 0.0, $12 = 0.0, $13 = 0.0, $14 = 0, $15 = 0, $16 = 0.0, $17 = 0.0, $18 = 0.0, $19 = 0, $2 = 0.0, $20 = 0, $3 = 0.0, $4 = 0.0, $5 = 0, $6 = 0.0, $7 = 0.0, $8 = 0.0, $9 = 0;
 var label = 0, sp = 0;
 sp = STACKTOP;
 STACKTOP = STACKTOP + 16|0; if ((STACKTOP|0) >= (STACK_MAX|0)) abortStackOverflow(16|0);
 $$byval_copy = sp + 4|0;
 ;HEAP32[$$byval_copy>>2]=HEAP32[$1>>2]|0;HEAP32[$$byval_copy+4>>2]=HEAP32[$1+4>>2]|0;HEAP32[$$byval_copy+8>>2]=HEAP32[$1+8>>2]|0; //@line 207 "../../src/imu/../quaternion/../math3d/math_3d.h"
 $3 = (+_v3_length_13($$byval_copy)); //@line 207 "../../src/imu/../quaternion/../math3d/math_3d.h"
 $2 = $3; //@line 207 "../../src/imu/../quaternion/../math3d/math_3d.h"
 $4 = $2; //@line 208 "../../src/imu/../quaternion/../math3d/math_3d.h"
 $5 = $4 > 0.0; //@line 208 "../../src/imu/../quaternion/../math3d/math_3d.h"
 if ($5) {
  $6 = +HEAPF32[$1>>2]; //@line 209 "../../src/imu/../quaternion/../math3d/math_3d.h"
  $7 = $2; //@line 209 "../../src/imu/../quaternion/../math3d/math_3d.h"
  $8 = $6 / $7; //@line 209 "../../src/imu/../quaternion/../math3d/math_3d.h"
  HEAPF32[$0>>2] = $8; //@line 209 "../../src/imu/../quaternion/../math3d/math_3d.h"
  $9 = ((($0)) + 4|0); //@line 209 "../../src/imu/../quaternion/../math3d/math_3d.h"
  $10 = ((($1)) + 4|0); //@line 209 "../../src/imu/../quaternion/../math3d/math_3d.h"
  $11 = +HEAPF32[$10>>2]; //@line 209 "../../src/imu/../quaternion/../math3d/math_3d.h"
  $12 = $2; //@line 209 "../../src/imu/../quaternion/../math3d/math_3d.h"
  $13 = $11 / $12; //@line 209 "../../src/imu/../quaternion/../math3d/math_3d.h"
  HEAPF32[$9>>2] = $13; //@line 209 "../../src/imu/../quaternion/../math3d/math_3d.h"
  $14 = ((($0)) + 8|0); //@line 209 "../../src/imu/../quaternion/../math3d/math_3d.h"
  $15 = ((($1)) + 8|0); //@line 209 "../../src/imu/../quaternion/../math3d/math_3d.h"
  $16 = +HEAPF32[$15>>2]; //@line 209 "../../src/imu/../quaternion/../math3d/math_3d.h"
  $17 = $2; //@line 209 "../../src/imu/../quaternion/../math3d/math_3d.h"
  $18 = $16 / $17; //@line 209 "../../src/imu/../quaternion/../math3d/math_3d.h"
  HEAPF32[$14>>2] = $18; //@line 209 "../../src/imu/../quaternion/../math3d/math_3d.h"
  STACKTOP = sp;return; //@line 212 "../../src/imu/../quaternion/../math3d/math_3d.h"
 } else {
  HEAPF32[$0>>2] = 0.0; //@line 211 "../../src/imu/../quaternion/../math3d/math_3d.h"
  $19 = ((($0)) + 4|0); //@line 211 "../../src/imu/../quaternion/../math3d/math_3d.h"
  HEAPF32[$19>>2] = 0.0; //@line 211 "../../src/imu/../quaternion/../math3d/math_3d.h"
  $20 = ((($0)) + 8|0); //@line 211 "../../src/imu/../quaternion/../math3d/math_3d.h"
  HEAPF32[$20>>2] = 0.0; //@line 211 "../../src/imu/../quaternion/../math3d/math_3d.h"
  STACKTOP = sp;return; //@line 212 "../../src/imu/../quaternion/../math3d/math_3d.h"
 }
}
function _quaternion_set_sign_like_example($0,$1,$2) {
 $0 = $0|0;
 $1 = $1|0;
 $2 = $2|0;
 var $$byval_copy = 0, $$byval_copy1 = 0, $$byval_copy2 = 0, $$byval_copy3 = 0, $$byval_copy4 = 0, $$byval_copy5 = 0, $$byval_copy6 = 0, $$byval_copy7 = 0, $3 = 0, $4 = 0, $5 = 0, $6 = 0.0, $7 = 0.0, $8 = 0, label = 0, sp = 0;
 sp = STACKTOP;
 STACKTOP = STACKTOP + 176|0; if ((STACKTOP|0) >= (STACK_MAX|0)) abortStackOverflow(176|0);
 $$byval_copy7 = sp + 160|0;
 $$byval_copy6 = sp + 144|0;
 $$byval_copy5 = sp + 128|0;
 $$byval_copy4 = sp + 112|0;
 $$byval_copy3 = sp + 96|0;
 $$byval_copy2 = sp + 80|0;
 $$byval_copy1 = sp + 64|0;
 $$byval_copy = sp + 48|0;
 $3 = sp + 32|0;
 $4 = sp + 16|0;
 $5 = sp;
 ;HEAP32[$$byval_copy>>2]=HEAP32[$1>>2]|0;HEAP32[$$byval_copy+4>>2]=HEAP32[$1+4>>2]|0;HEAP32[$$byval_copy+8>>2]=HEAP32[$1+8>>2]|0;HEAP32[$$byval_copy+12>>2]=HEAP32[$1+12>>2]|0; //@line 122 "../../src/imu/imu.c"
 ;HEAP32[$$byval_copy1>>2]=HEAP32[$2>>2]|0;HEAP32[$$byval_copy1+4>>2]=HEAP32[$2+4>>2]|0;HEAP32[$$byval_copy1+8>>2]=HEAP32[$2+8>>2]|0;HEAP32[$$byval_copy1+12>>2]=HEAP32[$2+12>>2]|0; //@line 122 "../../src/imu/imu.c"
 _quaternion_subtract($3,$$byval_copy,$$byval_copy1); //@line 122 "../../src/imu/imu.c"
 ;HEAP32[$$byval_copy2>>2]=HEAP32[$3>>2]|0;HEAP32[$$byval_copy2+4>>2]=HEAP32[$3+4>>2]|0;HEAP32[$$byval_copy2+8>>2]=HEAP32[$3+8>>2]|0;HEAP32[$$byval_copy2+12>>2]=HEAP32[$3+12>>2]|0; //@line 122 "../../src/imu/imu.c"
 $6 = (+_quaternion_norm_16($$byval_copy2)); //@line 122 "../../src/imu/imu.c"
 ;HEAP32[$$byval_copy3>>2]=HEAP32[$1>>2]|0;HEAP32[$$byval_copy3+4>>2]=HEAP32[$1+4>>2]|0;HEAP32[$$byval_copy3+8>>2]=HEAP32[$1+8>>2]|0;HEAP32[$$byval_copy3+12>>2]=HEAP32[$1+12>>2]|0; //@line 122 "../../src/imu/imu.c"
 _quaternion_negative($5,$$byval_copy3); //@line 122 "../../src/imu/imu.c"
 ;HEAP32[$$byval_copy4>>2]=HEAP32[$5>>2]|0;HEAP32[$$byval_copy4+4>>2]=HEAP32[$5+4>>2]|0;HEAP32[$$byval_copy4+8>>2]=HEAP32[$5+8>>2]|0;HEAP32[$$byval_copy4+12>>2]=HEAP32[$5+12>>2]|0; //@line 122 "../../src/imu/imu.c"
 ;HEAP32[$$byval_copy5>>2]=HEAP32[$2>>2]|0;HEAP32[$$byval_copy5+4>>2]=HEAP32[$2+4>>2]|0;HEAP32[$$byval_copy5+8>>2]=HEAP32[$2+8>>2]|0;HEAP32[$$byval_copy5+12>>2]=HEAP32[$2+12>>2]|0; //@line 122 "../../src/imu/imu.c"
 _quaternion_subtract($4,$$byval_copy4,$$byval_copy5); //@line 122 "../../src/imu/imu.c"
 ;HEAP32[$$byval_copy6>>2]=HEAP32[$4>>2]|0;HEAP32[$$byval_copy6+4>>2]=HEAP32[$4+4>>2]|0;HEAP32[$$byval_copy6+8>>2]=HEAP32[$4+8>>2]|0;HEAP32[$$byval_copy6+12>>2]=HEAP32[$4+12>>2]|0; //@line 122 "../../src/imu/imu.c"
 $7 = (+_quaternion_norm_16($$byval_copy6)); //@line 122 "../../src/imu/imu.c"
 $8 = $6 < $7; //@line 122 "../../src/imu/imu.c"
 if ($8) {
  ;HEAP32[$0>>2]=HEAP32[$1>>2]|0;HEAP32[$0+4>>2]=HEAP32[$1+4>>2]|0;HEAP32[$0+8>>2]=HEAP32[$1+8>>2]|0;HEAP32[$0+12>>2]=HEAP32[$1+12>>2]|0; //@line 124 "../../src/imu/imu.c"
  STACKTOP = sp;return; //@line 130 "../../src/imu/imu.c"
 } else {
  ;HEAP32[$$byval_copy7>>2]=HEAP32[$1>>2]|0;HEAP32[$$byval_copy7+4>>2]=HEAP32[$1+4>>2]|0;HEAP32[$$byval_copy7+8>>2]=HEAP32[$1+8>>2]|0;HEAP32[$$byval_copy7+12>>2]=HEAP32[$1+12>>2]|0; //@line 128 "../../src/imu/imu.c"
  _quaternion_negative($0,$$byval_copy7); //@line 128 "../../src/imu/imu.c"
  STACKTOP = sp;return; //@line 130 "../../src/imu/imu.c"
 }
}
function _quaternion_subtract($0,$1,$2) {
 $0 = $0|0;
 $1 = $1|0;
 $2 = $2|0;
 var $10 = 0, $11 = 0.0, $12 = 0.0, $13 = 0, $14 = 0, $15 = 0.0, $16 = 0, $17 = 0.0, $18 = 0.0, $19 = 0, $20 = 0, $21 = 0.0, $22 = 0, $23 = 0.0, $24 = 0.0, $3 = 0, $4 = 0.0, $5 = 0.0, $6 = 0.0, $7 = 0;
 var $8 = 0, $9 = 0.0, label = 0, sp = 0;
 sp = STACKTOP;
 STACKTOP = STACKTOP + 16|0; if ((STACKTOP|0) >= (STACK_MAX|0)) abortStackOverflow(16|0);
 $3 = sp;
 $4 = +HEAPF32[$1>>2]; //@line 311 "../../src/imu/../quaternion/quaternion.h"
 $5 = +HEAPF32[$2>>2]; //@line 311 "../../src/imu/../quaternion/quaternion.h"
 $6 = $4 - $5; //@line 311 "../../src/imu/../quaternion/quaternion.h"
 HEAPF32[$3>>2] = $6; //@line 310 "../../src/imu/../quaternion/quaternion.h"
 $7 = ((($3)) + 4|0); //@line 310 "../../src/imu/../quaternion/quaternion.h"
 $8 = ((($1)) + 4|0); //@line 312 "../../src/imu/../quaternion/quaternion.h"
 $9 = +HEAPF32[$8>>2]; //@line 312 "../../src/imu/../quaternion/quaternion.h"
 $10 = ((($2)) + 4|0); //@line 312 "../../src/imu/../quaternion/quaternion.h"
 $11 = +HEAPF32[$10>>2]; //@line 312 "../../src/imu/../quaternion/quaternion.h"
 $12 = $9 - $11; //@line 312 "../../src/imu/../quaternion/quaternion.h"
 HEAPF32[$7>>2] = $12; //@line 310 "../../src/imu/../quaternion/quaternion.h"
 $13 = ((($3)) + 8|0); //@line 310 "../../src/imu/../quaternion/quaternion.h"
 $14 = ((($1)) + 8|0); //@line 313 "../../src/imu/../quaternion/quaternion.h"
 $15 = +HEAPF32[$14>>2]; //@line 313 "../../src/imu/../quaternion/quaternion.h"
 $16 = ((($2)) + 8|0); //@line 313 "../../src/imu/../quaternion/quaternion.h"
 $17 = +HEAPF32[$16>>2]; //@line 313 "../../src/imu/../quaternion/quaternion.h"
 $18 = $15 - $17; //@line 313 "../../src/imu/../quaternion/quaternion.h"
 HEAPF32[$13>>2] = $18; //@line 310 "../../src/imu/../quaternion/quaternion.h"
 $19 = ((($3)) + 12|0); //@line 310 "../../src/imu/../quaternion/quaternion.h"
 $20 = ((($1)) + 12|0); //@line 314 "../../src/imu/../quaternion/quaternion.h"
 $21 = +HEAPF32[$20>>2]; //@line 314 "../../src/imu/../quaternion/quaternion.h"
 $22 = ((($2)) + 12|0); //@line 314 "../../src/imu/../quaternion/quaternion.h"
 $23 = +HEAPF32[$22>>2]; //@line 314 "../../src/imu/../quaternion/quaternion.h"
 $24 = $21 - $23; //@line 314 "../../src/imu/../quaternion/quaternion.h"
 HEAPF32[$19>>2] = $24; //@line 310 "../../src/imu/../quaternion/quaternion.h"
 ;HEAP32[$0>>2]=HEAP32[$3>>2]|0;HEAP32[$0+4>>2]=HEAP32[$3+4>>2]|0;HEAP32[$0+8>>2]=HEAP32[$3+8>>2]|0;HEAP32[$0+12>>2]=HEAP32[$3+12>>2]|0; //@line 316 "../../src/imu/../quaternion/quaternion.h"
 STACKTOP = sp;return; //@line 316 "../../src/imu/../quaternion/quaternion.h"
}
function _quaternion_norm_16($0) {
 $0 = $0|0;
 var $1 = 0.0, $10 = 0, $11 = 0.0, $12 = 0, $13 = 0.0, $14 = 0.0, $15 = 0.0, $16 = 0, $17 = 0.0, $18 = 0, $19 = 0.0, $2 = 0.0, $20 = 0.0, $21 = 0.0, $3 = 0.0, $4 = 0, $5 = 0.0, $6 = 0, $7 = 0.0, $8 = 0.0;
 var $9 = 0.0, label = 0, sp = 0;
 sp = STACKTOP;
 $1 = +HEAPF32[$0>>2]; //@line 119 "../../src/imu/../quaternion/quaternion.h"
 $2 = +HEAPF32[$0>>2]; //@line 119 "../../src/imu/../quaternion/quaternion.h"
 $3 = $1 * $2; //@line 119 "../../src/imu/../quaternion/quaternion.h"
 $4 = ((($0)) + 4|0); //@line 119 "../../src/imu/../quaternion/quaternion.h"
 $5 = +HEAPF32[$4>>2]; //@line 119 "../../src/imu/../quaternion/quaternion.h"
 $6 = ((($0)) + 4|0); //@line 119 "../../src/imu/../quaternion/quaternion.h"
 $7 = +HEAPF32[$6>>2]; //@line 119 "../../src/imu/../quaternion/quaternion.h"
 $8 = $5 * $7; //@line 119 "../../src/imu/../quaternion/quaternion.h"
 $9 = $3 + $8; //@line 119 "../../src/imu/../quaternion/quaternion.h"
 $10 = ((($0)) + 8|0); //@line 119 "../../src/imu/../quaternion/quaternion.h"
 $11 = +HEAPF32[$10>>2]; //@line 119 "../../src/imu/../quaternion/quaternion.h"
 $12 = ((($0)) + 8|0); //@line 119 "../../src/imu/../quaternion/quaternion.h"
 $13 = +HEAPF32[$12>>2]; //@line 119 "../../src/imu/../quaternion/quaternion.h"
 $14 = $11 * $13; //@line 119 "../../src/imu/../quaternion/quaternion.h"
 $15 = $9 + $14; //@line 119 "../../src/imu/../quaternion/quaternion.h"
 $16 = ((($0)) + 12|0); //@line 119 "../../src/imu/../quaternion/quaternion.h"
 $17 = +HEAPF32[$16>>2]; //@line 119 "../../src/imu/../quaternion/quaternion.h"
 $18 = ((($0)) + 12|0); //@line 119 "../../src/imu/../quaternion/quaternion.h"
 $19 = +HEAPF32[$18>>2]; //@line 119 "../../src/imu/../quaternion/quaternion.h"
 $20 = $17 * $19; //@line 119 "../../src/imu/../quaternion/quaternion.h"
 $21 = $15 + $20; //@line 119 "../../src/imu/../quaternion/quaternion.h"
 return (+$21); //@line 119 "../../src/imu/../quaternion/quaternion.h"
}
function _quaternion_negative($0,$1) {
 $0 = $0|0;
 $1 = $1|0;
 var $10 = 0, $11 = 0.0, $12 = 0.0, $13 = 0, $14 = 0, $15 = 0.0, $16 = 0.0, $2 = 0, $3 = 0.0, $4 = 0.0, $5 = 0, $6 = 0, $7 = 0.0, $8 = 0.0, $9 = 0, label = 0, sp = 0;
 sp = STACKTOP;
 STACKTOP = STACKTOP + 16|0; if ((STACKTOP|0) >= (STACK_MAX|0)) abortStackOverflow(16|0);
 $2 = sp;
 $3 = +HEAPF32[$1>>2]; //@line 186 "../../src/imu/../quaternion/quaternion.h"
 $4 = - $3; //@line 186 "../../src/imu/../quaternion/quaternion.h"
 HEAPF32[$2>>2] = $4; //@line 186 "../../src/imu/../quaternion/quaternion.h"
 $5 = ((($2)) + 4|0); //@line 186 "../../src/imu/../quaternion/quaternion.h"
 $6 = ((($1)) + 4|0); //@line 186 "../../src/imu/../quaternion/quaternion.h"
 $7 = +HEAPF32[$6>>2]; //@line 186 "../../src/imu/../quaternion/quaternion.h"
 $8 = - $7; //@line 186 "../../src/imu/../quaternion/quaternion.h"
 HEAPF32[$5>>2] = $8; //@line 186 "../../src/imu/../quaternion/quaternion.h"
 $9 = ((($2)) + 8|0); //@line 186 "../../src/imu/../quaternion/quaternion.h"
 $10 = ((($1)) + 8|0); //@line 186 "../../src/imu/../quaternion/quaternion.h"
 $11 = +HEAPF32[$10>>2]; //@line 186 "../../src/imu/../quaternion/quaternion.h"
 $12 = - $11; //@line 186 "../../src/imu/../quaternion/quaternion.h"
 HEAPF32[$9>>2] = $12; //@line 186 "../../src/imu/../quaternion/quaternion.h"
 $13 = ((($2)) + 12|0); //@line 186 "../../src/imu/../quaternion/quaternion.h"
 $14 = ((($1)) + 12|0); //@line 186 "../../src/imu/../quaternion/quaternion.h"
 $15 = +HEAPF32[$14>>2]; //@line 186 "../../src/imu/../quaternion/quaternion.h"
 $16 = - $15; //@line 186 "../../src/imu/../quaternion/quaternion.h"
 HEAPF32[$13>>2] = $16; //@line 186 "../../src/imu/../quaternion/quaternion.h"
 ;HEAP32[$0>>2]=HEAP32[$2>>2]|0;HEAP32[$0+4>>2]=HEAP32[$2+4>>2]|0;HEAP32[$0+8>>2]=HEAP32[$2+8>>2]|0;HEAP32[$0+12>>2]=HEAP32[$2+12>>2]|0; //@line 187 "../../src/imu/../quaternion/quaternion.h"
 STACKTOP = sp;return; //@line 187 "../../src/imu/../quaternion/quaternion.h"
}
function _compare_pitch_and_roll($0,$1) {
 $0 = $0|0;
 $1 = $1|0;
 var $$byval_copy = 0, $$byval_copy1 = 0, $$byval_copy2 = 0, $$byval_copy3 = 0, $$byval_copy4 = 0, $$byval_copy5 = 0, $$byval_copy6 = 0, $$byval_copy7 = 0, $10 = 0.0, $11 = 0.0, $12 = 0.0, $13 = 0.0, $14 = 0.0, $15 = 0.0, $16 = 0.0, $2 = 0.0, $3 = 0.0, $4 = 0, $5 = 0, $6 = 0;
 var $7 = 0, $8 = 0.0, $9 = 0.0, label = 0, sp = 0;
 sp = STACKTOP;
 STACKTOP = STACKTOP + 208|0; if ((STACKTOP|0) >= (STACK_MAX|0)) abortStackOverflow(208|0);
 $$byval_copy7 = sp + 184|0;
 $$byval_copy6 = sp + 168|0;
 $$byval_copy5 = sp + 152|0;
 $$byval_copy4 = sp + 136|0;
 $$byval_copy3 = sp + 120|0;
 $$byval_copy2 = sp + 104|0;
 $$byval_copy1 = sp + 88|0;
 $$byval_copy = sp + 72|0;
 $4 = sp + 48|0;
 $5 = sp + 32|0;
 $6 = sp + 16|0;
 $7 = sp;
 ;HEAP32[$$byval_copy>>2]=HEAP32[$0>>2]|0;HEAP32[$$byval_copy+4>>2]=HEAP32[$0+4>>2]|0;HEAP32[$$byval_copy+8>>2]=HEAP32[$0+8>>2]|0;HEAP32[$$byval_copy+12>>2]=HEAP32[$0+12>>2]|0; //@line 133 "../../src/imu/imu.c"
 $8 = (+_heading_from_quaternion($$byval_copy)); //@line 133 "../../src/imu/imu.c"
 $9 = $8; //@line 133 "../../src/imu/imu.c"
 $2 = $9; //@line 133 "../../src/imu/imu.c"
 ;HEAP32[$$byval_copy1>>2]=HEAP32[$1>>2]|0;HEAP32[$$byval_copy1+4>>2]=HEAP32[$1+4>>2]|0;HEAP32[$$byval_copy1+8>>2]=HEAP32[$1+8>>2]|0;HEAP32[$$byval_copy1+12>>2]=HEAP32[$1+12>>2]|0; //@line 134 "../../src/imu/imu.c"
 $10 = (+_heading_from_quaternion($$byval_copy1)); //@line 134 "../../src/imu/imu.c"
 $11 = $10; //@line 134 "../../src/imu/imu.c"
 $3 = $11; //@line 134 "../../src/imu/imu.c"
 $12 = $3; //@line 136 "../../src/imu/imu.c"
 $13 = $2; //@line 136 "../../src/imu/imu.c"
 $14 = $12 - $13; //@line 136 "../../src/imu/imu.c"
 _quaternion_from_heading_pitch_roll($5,$14,0.0,0.0); //@line 136 "../../src/imu/imu.c"
 ;HEAP32[$$byval_copy2>>2]=HEAP32[$5>>2]|0;HEAP32[$$byval_copy2+4>>2]=HEAP32[$5+4>>2]|0;HEAP32[$$byval_copy2+8>>2]=HEAP32[$5+8>>2]|0;HEAP32[$$byval_copy2+12>>2]=HEAP32[$5+12>>2]|0; //@line 136 "../../src/imu/imu.c"
 ;HEAP32[$$byval_copy3>>2]=HEAP32[$0>>2]|0;HEAP32[$$byval_copy3+4>>2]=HEAP32[$0+4>>2]|0;HEAP32[$$byval_copy3+8>>2]=HEAP32[$0+8>>2]|0;HEAP32[$$byval_copy3+12>>2]=HEAP32[$0+12>>2]|0; //@line 136 "../../src/imu/imu.c"
 _quaternion_multiply_14($4,$$byval_copy2,$$byval_copy3); //@line 136 "../../src/imu/imu.c"
 ;HEAP32[$$byval_copy4>>2]=HEAP32[$1>>2]|0;HEAP32[$$byval_copy4+4>>2]=HEAP32[$1+4>>2]|0;HEAP32[$$byval_copy4+8>>2]=HEAP32[$1+8>>2]|0;HEAP32[$$byval_copy4+12>>2]=HEAP32[$1+12>>2]|0; //@line 137 "../../src/imu/imu.c"
 _quaternion_inverse($7,$$byval_copy4); //@line 137 "../../src/imu/imu.c"
 ;HEAP32[$$byval_copy5>>2]=HEAP32[$4>>2]|0;HEAP32[$$byval_copy5+4>>2]=HEAP32[$4+4>>2]|0;HEAP32[$$byval_copy5+8>>2]=HEAP32[$4+8>>2]|0;HEAP32[$$byval_copy5+12>>2]=HEAP32[$4+12>>2]|0; //@line 137 "../../src/imu/imu.c"
 ;HEAP32[$$byval_copy6>>2]=HEAP32[$7>>2]|0;HEAP32[$$byval_copy6+4>>2]=HEAP32[$7+4>>2]|0;HEAP32[$$byval_copy6+8>>2]=HEAP32[$7+8>>2]|0;HEAP32[$$byval_copy6+12>>2]=HEAP32[$7+12>>2]|0; //@line 137 "../../src/imu/imu.c"
 _quaternion_multiply_14($6,$$byval_copy5,$$byval_copy6); //@line 137 "../../src/imu/imu.c"
 ;HEAP32[$$byval_copy7>>2]=HEAP32[$6>>2]|0;HEAP32[$$byval_copy7+4>>2]=HEAP32[$6+4>>2]|0;HEAP32[$$byval_copy7+8>>2]=HEAP32[$6+8>>2]|0;HEAP32[$$byval_copy7+12>>2]=HEAP32[$6+12>>2]|0; //@line 137 "../../src/imu/imu.c"
 $15 = (+_quaternion_angle($$byval_copy7)); //@line 137 "../../src/imu/imu.c"
 $16 = (+_radians_to_degrees($15)); //@line 137 "../../src/imu/imu.c"
 STACKTOP = sp;return (+$16); //@line 137 "../../src/imu/imu.c"
}
function _heading_from_quaternion($0) {
 $0 = $0|0;
 var $$byval_copy = 0, $1 = 0, $2 = 0.0, $3 = 0.0, label = 0, sp = 0;
 sp = STACKTOP;
 STACKTOP = STACKTOP + 32|0; if ((STACKTOP|0) >= (STACK_MAX|0)) abortStackOverflow(32|0);
 $$byval_copy = sp + 16|0;
 $1 = sp;
 ;HEAP32[$$byval_copy>>2]=HEAP32[$0>>2]|0;HEAP32[$$byval_copy+4>>2]=HEAP32[$0+4>>2]|0;HEAP32[$$byval_copy+8>>2]=HEAP32[$0+8>>2]|0;HEAP32[$$byval_copy+12>>2]=HEAP32[$0+12>>2]|0; //@line 265 "../../src/imu/imu.c"
 _heading_pitch_roll_from_quaternion($1,$$byval_copy); //@line 265 "../../src/imu/imu.c"
 $2 = +HEAPF32[$1>>2]; //@line 266 "../../src/imu/imu.c"
 $3 = $2; //@line 266 "../../src/imu/imu.c"
 STACKTOP = sp;return (+$3); //@line 266 "../../src/imu/imu.c"
}
function _quaternion_inverse($0,$1) {
 $0 = $0|0;
 $1 = $1|0;
 var $$byval_copy = 0, $10 = 0.0, $11 = 0.0, $12 = 0.0, $13 = 0.0, $14 = 0, $15 = 0, $16 = 0.0, $17 = 0.0, $18 = 0.0, $19 = 0.0, $2 = 0.0, $20 = 0, $21 = 0, $22 = 0.0, $23 = 0.0, $24 = 0.0, $25 = 0.0, $3 = 0, $4 = 0.0;
 var $5 = 0.0, $6 = 0.0, $7 = 0.0, $8 = 0, $9 = 0, label = 0, sp = 0;
 sp = STACKTOP;
 STACKTOP = STACKTOP + 48|0; if ((STACKTOP|0) >= (STACK_MAX|0)) abortStackOverflow(48|0);
 $$byval_copy = sp + 24|0;
 $3 = sp;
 ;HEAP32[$$byval_copy>>2]=HEAP32[$1>>2]|0;HEAP32[$$byval_copy+4>>2]=HEAP32[$1+4>>2]|0;HEAP32[$$byval_copy+8>>2]=HEAP32[$1+8>>2]|0;HEAP32[$$byval_copy+12>>2]=HEAP32[$1+12>>2]|0; //@line 194 "../../src/imu/../quaternion/quaternion.h"
 $4 = (+_quaternion_norm_16($$byval_copy)); //@line 194 "../../src/imu/../quaternion/quaternion.h"
 $2 = $4; //@line 194 "../../src/imu/../quaternion/quaternion.h"
 $5 = +HEAPF32[$1>>2]; //@line 195 "../../src/imu/../quaternion/quaternion.h"
 $6 = $2; //@line 195 "../../src/imu/../quaternion/quaternion.h"
 $7 = $5 / $6; //@line 195 "../../src/imu/../quaternion/quaternion.h"
 HEAPF32[$3>>2] = $7; //@line 195 "../../src/imu/../quaternion/quaternion.h"
 $8 = ((($3)) + 4|0); //@line 195 "../../src/imu/../quaternion/quaternion.h"
 $9 = ((($1)) + 4|0); //@line 195 "../../src/imu/../quaternion/quaternion.h"
 $10 = +HEAPF32[$9>>2]; //@line 195 "../../src/imu/../quaternion/quaternion.h"
 $11 = - $10; //@line 195 "../../src/imu/../quaternion/quaternion.h"
 $12 = $2; //@line 195 "../../src/imu/../quaternion/quaternion.h"
 $13 = $11 / $12; //@line 195 "../../src/imu/../quaternion/quaternion.h"
 HEAPF32[$8>>2] = $13; //@line 195 "../../src/imu/../quaternion/quaternion.h"
 $14 = ((($3)) + 8|0); //@line 195 "../../src/imu/../quaternion/quaternion.h"
 $15 = ((($1)) + 8|0); //@line 195 "../../src/imu/../quaternion/quaternion.h"
 $16 = +HEAPF32[$15>>2]; //@line 195 "../../src/imu/../quaternion/quaternion.h"
 $17 = - $16; //@line 195 "../../src/imu/../quaternion/quaternion.h"
 $18 = $2; //@line 195 "../../src/imu/../quaternion/quaternion.h"
 $19 = $17 / $18; //@line 195 "../../src/imu/../quaternion/quaternion.h"
 HEAPF32[$14>>2] = $19; //@line 195 "../../src/imu/../quaternion/quaternion.h"
 $20 = ((($3)) + 12|0); //@line 195 "../../src/imu/../quaternion/quaternion.h"
 $21 = ((($1)) + 12|0); //@line 195 "../../src/imu/../quaternion/quaternion.h"
 $22 = +HEAPF32[$21>>2]; //@line 195 "../../src/imu/../quaternion/quaternion.h"
 $23 = - $22; //@line 195 "../../src/imu/../quaternion/quaternion.h"
 $24 = $2; //@line 195 "../../src/imu/../quaternion/quaternion.h"
 $25 = $23 / $24; //@line 195 "../../src/imu/../quaternion/quaternion.h"
 HEAPF32[$20>>2] = $25; //@line 195 "../../src/imu/../quaternion/quaternion.h"
 ;HEAP32[$0>>2]=HEAP32[$3>>2]|0;HEAP32[$0+4>>2]=HEAP32[$3+4>>2]|0;HEAP32[$0+8>>2]=HEAP32[$3+8>>2]|0;HEAP32[$0+12>>2]=HEAP32[$3+12>>2]|0; //@line 196 "../../src/imu/../quaternion/quaternion.h"
 STACKTOP = sp;return; //@line 196 "../../src/imu/../quaternion/quaternion.h"
}
function _quaternion_angle($0) {
 $0 = $0|0;
 var $$byval_copy = 0, $$byval_copy1 = 0, $1 = 0, $2 = 0.0, $3 = 0.0, label = 0, sp = 0;
 sp = STACKTOP;
 STACKTOP = STACKTOP + 48|0; if ((STACKTOP|0) >= (STACK_MAX|0)) abortStackOverflow(48|0);
 $$byval_copy1 = sp + 32|0;
 $$byval_copy = sp + 16|0;
 $1 = sp;
 ;HEAP32[$$byval_copy>>2]=HEAP32[$0>>2]|0;HEAP32[$$byval_copy+4>>2]=HEAP32[$0+4>>2]|0;HEAP32[$$byval_copy+8>>2]=HEAP32[$0+8>>2]|0;HEAP32[$$byval_copy+12>>2]=HEAP32[$0+12>>2]|0; //@line 125 "../../src/imu/../quaternion/quaternion.h"
 _quaternion_log($1,$$byval_copy); //@line 125 "../../src/imu/../quaternion/quaternion.h"
 ;HEAP32[$$byval_copy1>>2]=HEAP32[$1>>2]|0;HEAP32[$$byval_copy1+4>>2]=HEAP32[$1+4>>2]|0;HEAP32[$$byval_copy1+8>>2]=HEAP32[$1+8>>2]|0;HEAP32[$$byval_copy1+12>>2]=HEAP32[$1+12>>2]|0; //@line 125 "../../src/imu/../quaternion/quaternion.h"
 $2 = (+_quaternion_absolute($$byval_copy1)); //@line 125 "../../src/imu/../quaternion/quaternion.h"
 $3 = 2.0 * $2; //@line 125 "../../src/imu/../quaternion/quaternion.h"
 STACKTOP = sp;return (+$3); //@line 125 "../../src/imu/../quaternion/quaternion.h"
}
function _quaternion_absolute($0) {
 $0 = $0|0;
 var $1 = 0.0, $10 = 0, $11 = 0.0, $12 = 0, $13 = 0.0, $14 = 0.0, $15 = 0.0, $16 = 0, $17 = 0.0, $18 = 0, $19 = 0.0, $2 = 0.0, $20 = 0.0, $21 = 0.0, $22 = 0.0, $23 = 0.0, $24 = 0.0, $3 = 0.0, $4 = 0, $5 = 0.0;
 var $6 = 0, $7 = 0.0, $8 = 0.0, $9 = 0.0, label = 0, sp = 0;
 sp = STACKTOP;
 $1 = +HEAPF32[$0>>2]; //@line 122 "../../src/imu/../quaternion/quaternion.h"
 $2 = +HEAPF32[$0>>2]; //@line 122 "../../src/imu/../quaternion/quaternion.h"
 $3 = $1 * $2; //@line 122 "../../src/imu/../quaternion/quaternion.h"
 $4 = ((($0)) + 4|0); //@line 122 "../../src/imu/../quaternion/quaternion.h"
 $5 = +HEAPF32[$4>>2]; //@line 122 "../../src/imu/../quaternion/quaternion.h"
 $6 = ((($0)) + 4|0); //@line 122 "../../src/imu/../quaternion/quaternion.h"
 $7 = +HEAPF32[$6>>2]; //@line 122 "../../src/imu/../quaternion/quaternion.h"
 $8 = $5 * $7; //@line 122 "../../src/imu/../quaternion/quaternion.h"
 $9 = $3 + $8; //@line 122 "../../src/imu/../quaternion/quaternion.h"
 $10 = ((($0)) + 8|0); //@line 122 "../../src/imu/../quaternion/quaternion.h"
 $11 = +HEAPF32[$10>>2]; //@line 122 "../../src/imu/../quaternion/quaternion.h"
 $12 = ((($0)) + 8|0); //@line 122 "../../src/imu/../quaternion/quaternion.h"
 $13 = +HEAPF32[$12>>2]; //@line 122 "../../src/imu/../quaternion/quaternion.h"
 $14 = $11 * $13; //@line 122 "../../src/imu/../quaternion/quaternion.h"
 $15 = $9 + $14; //@line 122 "../../src/imu/../quaternion/quaternion.h"
 $16 = ((($0)) + 12|0); //@line 122 "../../src/imu/../quaternion/quaternion.h"
 $17 = +HEAPF32[$16>>2]; //@line 122 "../../src/imu/../quaternion/quaternion.h"
 $18 = ((($0)) + 12|0); //@line 122 "../../src/imu/../quaternion/quaternion.h"
 $19 = +HEAPF32[$18>>2]; //@line 122 "../../src/imu/../quaternion/quaternion.h"
 $20 = $17 * $19; //@line 122 "../../src/imu/../quaternion/quaternion.h"
 $21 = $15 + $20; //@line 122 "../../src/imu/../quaternion/quaternion.h"
 $22 = $21; //@line 122 "../../src/imu/../quaternion/quaternion.h"
 $23 = (+Math_sqrt((+$22))); //@line 122 "../../src/imu/../quaternion/quaternion.h"
 $24 = $23; //@line 122 "../../src/imu/../quaternion/quaternion.h"
 return (+$24); //@line 122 "../../src/imu/../quaternion/quaternion.h"
}
function _heading_pitch_roll_from_quaternion($0,$1) {
 $0 = $0|0;
 $1 = $1|0;
 var $$byval_copy = 0, $10 = 0.0, $11 = 0.0, $12 = 0, $13 = 0.0, $14 = 0, $15 = 0.0, $16 = 0.0, $17 = 0.0, $18 = 0, $19 = 0.0, $2 = 0, $20 = 0, $21 = 0.0, $22 = 0.0, $23 = 0.0, $24 = 0, $25 = 0.0, $26 = 0, $27 = 0.0;
 var $28 = 0.0, $29 = 0.0, $3 = 0, $30 = 0, $31 = 0.0, $32 = 0, $33 = 0.0, $34 = 0.0, $35 = 0, $36 = 0.0, $37 = 0.0, $38 = 0.0, $39 = 0.0, $4 = 0.0, $40 = 0.0, $41 = 0.0, $42 = 0.0, $43 = 0.0, $44 = 0.0, $45 = 0.0;
 var $46 = 0.0, $47 = 0.0, $48 = 0.0, $49 = 0.0, $5 = 0.0, $50 = 0.0, $51 = 0.0, $52 = 0, $53 = 0.0, $54 = 0, $55 = 0.0, $56 = 0.0, $57 = 0, $58 = 0.0, $59 = 0.0, $6 = 0.0, $60 = 0.0, $61 = 0.0, $62 = 0.0, $63 = 0.0;
 var $64 = 0.0, $65 = 0.0, $66 = 0.0, $67 = 0.0, $68 = 0.0, $69 = 0.0, $7 = 0.0, $70 = 0.0, $71 = 0.0, $72 = 0.0, $73 = 0.0, $74 = 0.0, $75 = 0, $76 = 0, $77 = 0.0, $78 = 0, $79 = 0.0, $8 = 0.0, $80 = 0.0, $81 = 0;
 var $82 = 0.0, $83 = 0.0, $84 = 0.0, $85 = 0.0, $86 = 0.0, $87 = 0.0, $88 = 0.0, $89 = 0.0, $9 = 0.0, $90 = 0.0, $91 = 0.0, $92 = 0.0, $93 = 0.0, $94 = 0.0, $95 = 0.0, $96 = 0.0, $97 = 0.0, $98 = 0.0, $99 = 0, label = 0;
 var sp = 0;
 sp = STACKTOP;
 STACKTOP = STACKTOP + 80|0; if ((STACKTOP|0) >= (STACK_MAX|0)) abortStackOverflow(80|0);
 $$byval_copy = sp + 64|0;
 $2 = sp + 48|0;
 $3 = sp + 32|0;
 ;HEAP32[$$byval_copy>>2]=HEAP32[$1>>2]|0;HEAP32[$$byval_copy+4>>2]=HEAP32[$1+4>>2]|0;HEAP32[$$byval_copy+8>>2]=HEAP32[$1+8>>2]|0;HEAP32[$$byval_copy+12>>2]=HEAP32[$1+12>>2]|0; //@line 227 "../../src/imu/imu.c"
 _quaternion_normalized($2,$$byval_copy); //@line 227 "../../src/imu/imu.c"
 $8 = +HEAPF32[$2>>2]; //@line 230 "../../src/imu/imu.c"
 $9 = +HEAPF32[$2>>2]; //@line 230 "../../src/imu/imu.c"
 $10 = $8 * $9; //@line 230 "../../src/imu/imu.c"
 $11 = $10; //@line 230 "../../src/imu/imu.c"
 $4 = $11; //@line 230 "../../src/imu/imu.c"
 $12 = ((($2)) + 4|0); //@line 231 "../../src/imu/imu.c"
 $13 = +HEAPF32[$12>>2]; //@line 231 "../../src/imu/imu.c"
 $14 = ((($2)) + 4|0); //@line 231 "../../src/imu/imu.c"
 $15 = +HEAPF32[$14>>2]; //@line 231 "../../src/imu/imu.c"
 $16 = $13 * $15; //@line 231 "../../src/imu/imu.c"
 $17 = $16; //@line 231 "../../src/imu/imu.c"
 $5 = $17; //@line 231 "../../src/imu/imu.c"
 $18 = ((($2)) + 8|0); //@line 232 "../../src/imu/imu.c"
 $19 = +HEAPF32[$18>>2]; //@line 232 "../../src/imu/imu.c"
 $20 = ((($2)) + 8|0); //@line 232 "../../src/imu/imu.c"
 $21 = +HEAPF32[$20>>2]; //@line 232 "../../src/imu/imu.c"
 $22 = $19 * $21; //@line 232 "../../src/imu/imu.c"
 $23 = $22; //@line 232 "../../src/imu/imu.c"
 $6 = $23; //@line 232 "../../src/imu/imu.c"
 $24 = ((($2)) + 12|0); //@line 233 "../../src/imu/imu.c"
 $25 = +HEAPF32[$24>>2]; //@line 233 "../../src/imu/imu.c"
 $26 = ((($2)) + 12|0); //@line 233 "../../src/imu/imu.c"
 $27 = +HEAPF32[$26>>2]; //@line 233 "../../src/imu/imu.c"
 $28 = $25 * $27; //@line 233 "../../src/imu/imu.c"
 $29 = $28; //@line 233 "../../src/imu/imu.c"
 $7 = $29; //@line 233 "../../src/imu/imu.c"
 $30 = ((($2)) + 4|0); //@line 235 "../../src/imu/imu.c"
 $31 = +HEAPF32[$30>>2]; //@line 235 "../../src/imu/imu.c"
 $32 = ((($2)) + 8|0); //@line 235 "../../src/imu/imu.c"
 $33 = +HEAPF32[$32>>2]; //@line 235 "../../src/imu/imu.c"
 $34 = $31 * $33; //@line 235 "../../src/imu/imu.c"
 $35 = ((($2)) + 12|0); //@line 235 "../../src/imu/imu.c"
 $36 = +HEAPF32[$35>>2]; //@line 235 "../../src/imu/imu.c"
 $37 = +HEAPF32[$2>>2]; //@line 235 "../../src/imu/imu.c"
 $38 = $36 * $37; //@line 235 "../../src/imu/imu.c"
 $39 = $34 + $38; //@line 235 "../../src/imu/imu.c"
 $40 = $39; //@line 235 "../../src/imu/imu.c"
 $41 = 2.0 * $40; //@line 235 "../../src/imu/imu.c"
 $42 = $5; //@line 235 "../../src/imu/imu.c"
 $43 = $6; //@line 235 "../../src/imu/imu.c"
 $44 = $42 - $43; //@line 235 "../../src/imu/imu.c"
 $45 = $7; //@line 235 "../../src/imu/imu.c"
 $46 = $44 - $45; //@line 235 "../../src/imu/imu.c"
 $47 = $4; //@line 235 "../../src/imu/imu.c"
 $48 = $46 + $47; //@line 235 "../../src/imu/imu.c"
 $49 = (+Math_atan2((+$41),(+$48))); //@line 235 "../../src/imu/imu.c"
 $50 = $49; //@line 235 "../../src/imu/imu.c"
 $51 = (+_radians_to_degrees($50)); //@line 235 "../../src/imu/imu.c"
 HEAPF32[$3>>2] = $51; //@line 235 "../../src/imu/imu.c"
 $52 = ((($2)) + 4|0); //@line 236 "../../src/imu/imu.c"
 $53 = +HEAPF32[$52>>2]; //@line 236 "../../src/imu/imu.c"
 $54 = ((($2)) + 12|0); //@line 236 "../../src/imu/imu.c"
 $55 = +HEAPF32[$54>>2]; //@line 236 "../../src/imu/imu.c"
 $56 = $53 * $55; //@line 236 "../../src/imu/imu.c"
 $57 = ((($2)) + 8|0); //@line 236 "../../src/imu/imu.c"
 $58 = +HEAPF32[$57>>2]; //@line 236 "../../src/imu/imu.c"
 $59 = +HEAPF32[$2>>2]; //@line 236 "../../src/imu/imu.c"
 $60 = $58 * $59; //@line 236 "../../src/imu/imu.c"
 $61 = $56 - $60; //@line 236 "../../src/imu/imu.c"
 $62 = $61; //@line 236 "../../src/imu/imu.c"
 $63 = -2.0 * $62; //@line 236 "../../src/imu/imu.c"
 $64 = $5; //@line 236 "../../src/imu/imu.c"
 $65 = $6; //@line 236 "../../src/imu/imu.c"
 $66 = $64 + $65; //@line 236 "../../src/imu/imu.c"
 $67 = $7; //@line 236 "../../src/imu/imu.c"
 $68 = $66 + $67; //@line 236 "../../src/imu/imu.c"
 $69 = $4; //@line 236 "../../src/imu/imu.c"
 $70 = $68 + $69; //@line 236 "../../src/imu/imu.c"
 $71 = $63 / $70; //@line 236 "../../src/imu/imu.c"
 $72 = (+Math_asin((+$71))); //@line 236 "../../src/imu/imu.c"
 $73 = $72; //@line 236 "../../src/imu/imu.c"
 $74 = (+_radians_to_degrees($73)); //@line 236 "../../src/imu/imu.c"
 $75 = ((($3)) + 4|0); //@line 236 "../../src/imu/imu.c"
 HEAPF32[$75>>2] = $74; //@line 236 "../../src/imu/imu.c"
 $76 = ((($2)) + 8|0); //@line 237 "../../src/imu/imu.c"
 $77 = +HEAPF32[$76>>2]; //@line 237 "../../src/imu/imu.c"
 $78 = ((($2)) + 12|0); //@line 237 "../../src/imu/imu.c"
 $79 = +HEAPF32[$78>>2]; //@line 237 "../../src/imu/imu.c"
 $80 = $77 * $79; //@line 237 "../../src/imu/imu.c"
 $81 = ((($2)) + 4|0); //@line 237 "../../src/imu/imu.c"
 $82 = +HEAPF32[$81>>2]; //@line 237 "../../src/imu/imu.c"
 $83 = +HEAPF32[$2>>2]; //@line 237 "../../src/imu/imu.c"
 $84 = $82 * $83; //@line 237 "../../src/imu/imu.c"
 $85 = $80 + $84; //@line 237 "../../src/imu/imu.c"
 $86 = $85; //@line 237 "../../src/imu/imu.c"
 $87 = 2.0 * $86; //@line 237 "../../src/imu/imu.c"
 $88 = $5; //@line 237 "../../src/imu/imu.c"
 $89 = - $88; //@line 237 "../../src/imu/imu.c"
 $90 = $6; //@line 237 "../../src/imu/imu.c"
 $91 = $89 - $90; //@line 237 "../../src/imu/imu.c"
 $92 = $7; //@line 237 "../../src/imu/imu.c"
 $93 = $91 + $92; //@line 237 "../../src/imu/imu.c"
 $94 = $4; //@line 237 "../../src/imu/imu.c"
 $95 = $93 + $94; //@line 237 "../../src/imu/imu.c"
 $96 = (+Math_atan2((+$87),(+$95))); //@line 237 "../../src/imu/imu.c"
 $97 = $96; //@line 237 "../../src/imu/imu.c"
 $98 = (+_radians_to_degrees($97)); //@line 237 "../../src/imu/imu.c"
 $99 = ((($3)) + 8|0); //@line 237 "../../src/imu/imu.c"
 HEAPF32[$99>>2] = $98; //@line 237 "../../src/imu/imu.c"
 ;HEAP32[$0>>2]=HEAP32[$3>>2]|0;HEAP32[$0+4>>2]=HEAP32[$3+4>>2]|0;HEAP32[$0+8>>2]=HEAP32[$3+8>>2]|0; //@line 239 "../../src/imu/imu.c"
 STACKTOP = sp;return; //@line 239 "../../src/imu/imu.c"
}
function _quaternion_normalized($0,$1) {
 $0 = $0|0;
 $1 = $1|0;
 var $$byval_copy = 0, $10 = 0.0, $11 = 0.0, $12 = 0.0, $13 = 0, $14 = 0, $15 = 0.0, $16 = 0.0, $17 = 0.0, $18 = 0, $19 = 0, $2 = 0.0, $20 = 0.0, $21 = 0.0, $22 = 0.0, $3 = 0, $4 = 0.0, $5 = 0.0, $6 = 0.0, $7 = 0.0;
 var $8 = 0, $9 = 0, label = 0, sp = 0;
 sp = STACKTOP;
 STACKTOP = STACKTOP + 48|0; if ((STACKTOP|0) >= (STACK_MAX|0)) abortStackOverflow(48|0);
 $$byval_copy = sp + 24|0;
 $3 = sp;
 ;HEAP32[$$byval_copy>>2]=HEAP32[$1>>2]|0;HEAP32[$$byval_copy+4>>2]=HEAP32[$1+4>>2]|0;HEAP32[$$byval_copy+8>>2]=HEAP32[$1+8>>2]|0;HEAP32[$$byval_copy+12>>2]=HEAP32[$1+12>>2]|0; //@line 133 "../../src/imu/../quaternion/quaternion.h"
 $4 = (+_quaternion_absolute($$byval_copy)); //@line 133 "../../src/imu/../quaternion/quaternion.h"
 $2 = $4; //@line 133 "../../src/imu/../quaternion/quaternion.h"
 $5 = +HEAPF32[$1>>2]; //@line 134 "../../src/imu/../quaternion/quaternion.h"
 $6 = $2; //@line 134 "../../src/imu/../quaternion/quaternion.h"
 $7 = $5 / $6; //@line 134 "../../src/imu/../quaternion/quaternion.h"
 HEAPF32[$3>>2] = $7; //@line 134 "../../src/imu/../quaternion/quaternion.h"
 $8 = ((($3)) + 4|0); //@line 134 "../../src/imu/../quaternion/quaternion.h"
 $9 = ((($1)) + 4|0); //@line 134 "../../src/imu/../quaternion/quaternion.h"
 $10 = +HEAPF32[$9>>2]; //@line 134 "../../src/imu/../quaternion/quaternion.h"
 $11 = $2; //@line 134 "../../src/imu/../quaternion/quaternion.h"
 $12 = $10 / $11; //@line 134 "../../src/imu/../quaternion/quaternion.h"
 HEAPF32[$8>>2] = $12; //@line 134 "../../src/imu/../quaternion/quaternion.h"
 $13 = ((($3)) + 8|0); //@line 134 "../../src/imu/../quaternion/quaternion.h"
 $14 = ((($1)) + 8|0); //@line 134 "../../src/imu/../quaternion/quaternion.h"
 $15 = +HEAPF32[$14>>2]; //@line 134 "../../src/imu/../quaternion/quaternion.h"
 $16 = $2; //@line 134 "../../src/imu/../quaternion/quaternion.h"
 $17 = $15 / $16; //@line 134 "../../src/imu/../quaternion/quaternion.h"
 HEAPF32[$13>>2] = $17; //@line 134 "../../src/imu/../quaternion/quaternion.h"
 $18 = ((($3)) + 12|0); //@line 134 "../../src/imu/../quaternion/quaternion.h"
 $19 = ((($1)) + 12|0); //@line 134 "../../src/imu/../quaternion/quaternion.h"
 $20 = +HEAPF32[$19>>2]; //@line 134 "../../src/imu/../quaternion/quaternion.h"
 $21 = $2; //@line 134 "../../src/imu/../quaternion/quaternion.h"
 $22 = $20 / $21; //@line 134 "../../src/imu/../quaternion/quaternion.h"
 HEAPF32[$18>>2] = $22; //@line 134 "../../src/imu/../quaternion/quaternion.h"
 ;HEAP32[$0>>2]=HEAP32[$3>>2]|0;HEAP32[$0+4>>2]=HEAP32[$3+4>>2]|0;HEAP32[$0+8>>2]=HEAP32[$3+8>>2]|0;HEAP32[$0+12>>2]=HEAP32[$3+12>>2]|0; //@line 135 "../../src/imu/../quaternion/quaternion.h"
 STACKTOP = sp;return; //@line 135 "../../src/imu/../quaternion/quaternion.h"
}
function _imu_update_magnetic_field($0,$1,$2,$3) {
 $0 = $0|0;
 $1 = $1|0;
 $2 = $2|0;
 $3 = $3|0;
 var $$byval_copy = 0, $$byval_copy1 = 0, $$byval_copy10 = 0, $$byval_copy11 = 0, $$byval_copy12 = 0, $$byval_copy13 = 0, $$byval_copy14 = 0, $$byval_copy15 = 0, $$byval_copy16 = 0, $$byval_copy17 = 0, $$byval_copy18 = 0, $$byval_copy19 = 0, $$byval_copy2 = 0, $$byval_copy20 = 0, $$byval_copy21 = 0, $$byval_copy3 = 0, $$byval_copy4 = 0, $$byval_copy5 = 0, $$byval_copy6 = 0, $$byval_copy7 = 0;
 var $$byval_copy8 = 0, $$byval_copy9 = 0, $10 = 0, $100 = 0, $101 = 0, $102 = 0, $103 = 0, $104 = 0.0, $105 = 0, $106 = 0.0, $107 = 0, $108 = 0.0, $109 = 0, $11 = 0, $110 = 0, $111 = 0, $112 = 0.0, $113 = 0, $114 = 0, $115 = 0;
 var $116 = 0, $117 = 0, $118 = 0, $119 = 0, $12 = 0, $120 = 0, $121 = 0, $122 = 0, $123 = 0, $124 = 0, $125 = 0, $126 = 0, $127 = 0, $128 = 0.0, $129 = 0.0, $13 = 0, $130 = 0, $131 = 0, $132 = 0, $133 = 0;
 var $134 = 0, $135 = 0, $136 = 0, $137 = 0, $138 = 0.0, $139 = 0.0, $14 = 0, $140 = 0, $141 = 0, $142 = 0, $143 = 0, $144 = 0, $145 = 0, $146 = 0, $147 = 0, $148 = 0, $149 = 0.0, $15 = 0, $150 = 0.0, $151 = 0;
 var $152 = 0, $153 = 0, $154 = 0, $155 = 0, $156 = 0, $157 = 0, $158 = 0, $159 = 0, $16 = 0, $160 = 0.0, $161 = 0.0, $162 = 0, $163 = 0, $164 = 0, $165 = 0, $166 = 0, $167 = 0, $168 = 0, $169 = 0, $17 = 0.0;
 var $170 = 0.0, $171 = 0.0, $172 = 0, $173 = 0, $174 = 0, $175 = 0, $176 = 0, $177 = 0, $178 = 0, $179 = 0, $18 = 0.0, $180 = 0, $181 = 0.0, $182 = 0.0, $183 = 0, $184 = 0, $185 = 0, $186 = 0, $187 = 0, $188 = 0;
 var $189 = 0, $19 = 0.0, $190 = 0, $191 = 0, $192 = 0.0, $193 = 0.0, $194 = 0, $195 = 0, $196 = 0, $197 = 0, $198 = 0, $199 = 0, $20 = 0, $200 = 0, $201 = 0, $202 = 0, $203 = 0, $204 = 0, $205 = 0, $206 = 0;
 var $207 = 0, $208 = 0, $209 = 0, $21 = 0, $210 = 0, $211 = 0, $212 = 0, $213 = 0.0, $214 = 0, $215 = 0, $216 = 0, $217 = 0, $218 = 0, $219 = 0, $22 = 0, $220 = 0, $221 = 0, $222 = 0, $223 = 0, $224 = 0;
 var $225 = 0.0, $226 = 0.0, $227 = 0, $228 = 0, $229 = 0, $23 = 0, $230 = 0, $231 = 0.0, $232 = 0.0, $233 = 0, $234 = 0, $235 = 0, $236 = 0, $237 = 0, $238 = 0.0, $239 = 0.0, $24 = 0, $240 = 0, $241 = 0, $242 = 0;
 var $243 = 0, $244 = 0, $245 = 0.0, $246 = 0.0, $247 = 0, $248 = 0, $249 = 0.0, $25 = 0, $250 = 0, $251 = 0, $252 = 0.0, $253 = 0.0, $254 = 0, $255 = 0, $256 = 0.0, $257 = 0.0, $258 = 0, $259 = 0.0, $26 = 0, $260 = 0;
 var $261 = 0, $262 = 0, $263 = 0, $264 = 0, $265 = 0, $266 = 0.0, $267 = 0.0, $268 = 0, $269 = 0, $27 = 0, $270 = 0, $271 = 0, $272 = 0.0, $273 = 0.0, $274 = 0, $275 = 0, $276 = 0, $277 = 0, $278 = 0, $279 = 0.0;
 var $28 = 0, $280 = 0.0, $281 = 0, $282 = 0, $283 = 0, $284 = 0.0, $285 = 0, $286 = 0, $287 = 0, $288 = 0, $289 = 0, $29 = 0, $290 = 0, $291 = 0, $292 = 0, $293 = 0, $294 = 0, $295 = 0, $296 = 0, $297 = 0;
 var $298 = 0, $299 = 0, $30 = 0.0, $300 = 0.0, $301 = 0.0, $302 = 0, $303 = 0, $304 = 0, $305 = 0, $306 = 0, $307 = 0, $308 = 0, $309 = 0, $31 = 0.0, $310 = 0, $311 = 0, $312 = 0, $313 = 0, $314 = 0.0, $315 = 0.0;
 var $316 = 0, $317 = 0, $318 = 0, $319 = 0, $32 = 0, $320 = 0, $321 = 0, $322 = 0, $323 = 0, $324 = 0, $325 = 0, $326 = 0, $327 = 0, $328 = 0.0, $329 = 0.0, $33 = 0, $330 = 0, $331 = 0, $332 = 0, $333 = 0;
 var $334 = 0, $335 = 0, $336 = 0, $337 = 0, $338 = 0, $339 = 0, $34 = 0.0, $340 = 0, $341 = 0, $342 = 0.0, $343 = 0.0, $344 = 0, $345 = 0, $346 = 0, $347 = 0, $348 = 0, $349 = 0, $35 = 0.0, $350 = 0, $351 = 0;
 var $352 = 0, $353 = 0, $354 = 0, $355 = 0, $356 = 0.0, $357 = 0.0, $358 = 0, $359 = 0, $36 = 0, $360 = 0, $361 = 0, $362 = 0, $363 = 0, $364 = 0, $365 = 0, $366 = 0, $367 = 0, $368 = 0, $369 = 0, $37 = 0;
 var $370 = 0.0, $371 = 0.0, $372 = 0, $373 = 0, $374 = 0, $375 = 0, $376 = 0, $377 = 0, $378 = 0, $379 = 0, $38 = 0.0, $380 = 0, $381 = 0, $382 = 0, $383 = 0, $384 = 0.0, $385 = 0.0, $386 = 0, $387 = 0, $388 = 0;
 var $389 = 0, $39 = 0.0, $390 = 0, $391 = 0, $392 = 0, $393 = 0, $394 = 0, $395 = 0, $396 = 0, $397 = 0, $398 = 0, $399 = 0, $4 = 0, $40 = 0, $400 = 0, $401 = 0, $402 = 0, $403 = 0, $404 = 0, $405 = 0;
 var $406 = 0, $407 = 0.0, $408 = 0.0, $409 = 0, $41 = 0, $410 = 0, $411 = 0, $412 = 0, $413 = 0, $414 = 0, $415 = 0, $416 = 0.0, $417 = 0.0, $418 = 0, $419 = 0, $42 = 0, $420 = 0, $421 = 0, $422 = 0, $423 = 0;
 var $424 = 0, $425 = 0, $426 = 0.0, $427 = 0.0, $428 = 0, $429 = 0, $43 = 0, $430 = 0, $431 = 0, $44 = 0, $45 = 0, $46 = 0, $47 = 0, $48 = 0.0, $49 = 0.0, $5 = 0, $50 = 0, $51 = 0.0, $52 = 0.0, $53 = 0.0;
 var $54 = 0.0, $55 = 0.0, $56 = 0.0, $57 = 0, $58 = 0.0, $59 = 0.0, $6 = 0, $60 = 0.0, $61 = 0.0, $62 = 0.0, $63 = 0, $64 = 0.0, $65 = 0, $66 = 0.0, $67 = 0.0, $68 = 0.0, $69 = 0.0, $7 = 0, $70 = 0.0, $71 = 0.0;
 var $72 = 0.0, $73 = 0.0, $74 = 0.0, $75 = 0.0, $76 = 0.0, $77 = 0.0, $78 = 0, $79 = 0.0, $8 = 0, $80 = 0, $81 = 0.0, $82 = 0.0, $83 = 0, $84 = 0.0, $85 = 0, $86 = 0.0, $87 = 0.0, $88 = 0.0, $89 = 0.0, $9 = 0;
 var $90 = 0.0, $91 = 0.0, $92 = 0.0, $93 = 0.0, $94 = 0.0, $95 = 0.0, $96 = 0.0, $97 = 0.0, $98 = 0, $99 = 0, label = 0, sp = 0;
 sp = STACKTOP;
 STACKTOP = STACKTOP + 608|0; if ((STACKTOP|0) >= (STACK_MAX|0)) abortStackOverflow(608|0);
 $$byval_copy21 = sp + 584|0;
 $$byval_copy20 = sp + 568|0;
 $$byval_copy19 = sp + 552|0;
 $$byval_copy18 = sp + 536|0;
 $$byval_copy17 = sp + 520|0;
 $$byval_copy16 = sp + 504|0;
 $$byval_copy15 = sp + 488|0;
 $$byval_copy14 = sp + 472|0;
 $$byval_copy13 = sp + 456|0;
 $$byval_copy12 = sp + 440|0;
 $$byval_copy11 = sp + 428|0;
 $$byval_copy10 = sp + 416|0;
 $$byval_copy9 = sp + 404|0;
 $$byval_copy8 = sp + 392|0;
 $$byval_copy7 = sp + 380|0;
 $$byval_copy6 = sp + 368|0;
 $$byval_copy5 = sp + 352|0;
 $$byval_copy4 = sp + 340|0;
 $$byval_copy3 = sp + 328|0;
 $$byval_copy2 = sp + 316|0;
 $$byval_copy1 = sp + 304|0;
 $$byval_copy = sp + 292|0;
 $7 = sp + 268|0;
 $8 = sp + 256|0;
 $9 = sp + 244|0;
 $10 = sp + 232|0;
 $11 = sp + 216|0;
 $12 = sp + 204|0;
 $13 = sp + 192|0;
 $14 = sp + 180|0;
 $15 = sp + 168|0;
 $16 = sp + 156|0;
 $20 = sp + 132|0;
 $21 = sp + 120|0;
 $22 = sp + 104|0;
 $23 = sp + 88|0;
 $25 = sp + 24|0;
 $26 = sp;
 $27 = sp + 64|0;
 $28 = sp + 48|0;
 $4 = $0;
 $5 = $2;
 $6 = $3;
 $29 = ((($1)) + 16|0); //@line 143 "../../src/imu/imu.c"
 $30 = +HEAPF64[$29>>3]; //@line 143 "../../src/imu/imu.c"
 $31 = $30; //@line 143 "../../src/imu/imu.c"
 $32 = ((($1)) + 16|0); //@line 143 "../../src/imu/imu.c"
 $33 = ((($32)) + 8|0); //@line 143 "../../src/imu/imu.c"
 $34 = +HEAPF64[$33>>3]; //@line 143 "../../src/imu/imu.c"
 $35 = $34; //@line 143 "../../src/imu/imu.c"
 $36 = ((($1)) + 16|0); //@line 143 "../../src/imu/imu.c"
 $37 = ((($36)) + 16|0); //@line 143 "../../src/imu/imu.c"
 $38 = +HEAPF64[$37>>3]; //@line 143 "../../src/imu/imu.c"
 $39 = $38; //@line 143 "../../src/imu/imu.c"
 _vec3_10($7,$31,$35,$39); //@line 143 "../../src/imu/imu.c"
 $40 = $4; //@line 145 "../../src/imu/imu.c"
 $41 = ((($40)) + 1204|0); //@line 145 "../../src/imu/imu.c"
 $42 = $4; //@line 145 "../../src/imu/imu.c"
 $43 = ((($42)) + 1192|0); //@line 145 "../../src/imu/imu.c"
 ;HEAP32[$$byval_copy>>2]=HEAP32[$7>>2]|0;HEAP32[$$byval_copy+4>>2]=HEAP32[$7+4>>2]|0;HEAP32[$$byval_copy+8>>2]=HEAP32[$7+8>>2]|0; //@line 145 "../../src/imu/imu.c"
 ;HEAP32[$$byval_copy1>>2]=HEAP32[$43>>2]|0;HEAP32[$$byval_copy1+4>>2]=HEAP32[$43+4>>2]|0;HEAP32[$$byval_copy1+8>>2]=HEAP32[$43+8>>2]|0; //@line 145 "../../src/imu/imu.c"
 _v3_sub_11($9,$$byval_copy,$$byval_copy1); //@line 145 "../../src/imu/imu.c"
 ;HEAP32[$$byval_copy2>>2]=HEAP32[$41>>2]|0;HEAP32[$$byval_copy2+4>>2]=HEAP32[$41+4>>2]|0;HEAP32[$$byval_copy2+8>>2]=HEAP32[$41+8>>2]|0; //@line 145 "../../src/imu/imu.c"
 ;HEAP32[$$byval_copy3>>2]=HEAP32[$9>>2]|0;HEAP32[$$byval_copy3+4>>2]=HEAP32[$9+4>>2]|0;HEAP32[$$byval_copy3+8>>2]=HEAP32[$9+8>>2]|0; //@line 145 "../../src/imu/imu.c"
 _v3_mul($8,$$byval_copy2,$$byval_copy3); //@line 145 "../../src/imu/imu.c"
 $44 = $4; //@line 148 "../../src/imu/imu.c"
 $45 = ((($44)) + 1216|0); //@line 148 "../../src/imu/imu.c"
 ;HEAP32[$$byval_copy4>>2]=HEAP32[$45>>2]|0;HEAP32[$$byval_copy4+4>>2]=HEAP32[$45+4>>2]|0;HEAP32[$$byval_copy4+8>>2]=HEAP32[$45+8>>2]|0; //@line 148 "../../src/imu/imu.c"
 _quaternion_from_hpr($11,$$byval_copy4); //@line 148 "../../src/imu/imu.c"
 ;HEAP32[$$byval_copy5>>2]=HEAP32[$11>>2]|0;HEAP32[$$byval_copy5+4>>2]=HEAP32[$11+4>>2]|0;HEAP32[$$byval_copy5+8>>2]=HEAP32[$11+8>>2]|0;HEAP32[$$byval_copy5+12>>2]=HEAP32[$11+12>>2]|0; //@line 148 "../../src/imu/imu.c"
 ;HEAP32[$$byval_copy6>>2]=HEAP32[$8>>2]|0;HEAP32[$$byval_copy6+4>>2]=HEAP32[$8+4>>2]|0;HEAP32[$$byval_copy6+8>>2]=HEAP32[$8+8>>2]|0; //@line 148 "../../src/imu/imu.c"
 _quaternion_rotate_vec3($$byval_copy5,$$byval_copy6,$10); //@line 148 "../../src/imu/imu.c"
 $46 = $4; //@line 150 "../../src/imu/imu.c"
 $47 = ((($46)) + 40|0); //@line 150 "../../src/imu/imu.c"
 ;HEAP32[$12>>2]=HEAP32[$47>>2]|0;HEAP32[$12+4>>2]=HEAP32[$47+4>>2]|0;HEAP32[$12+8>>2]=HEAP32[$47+8>>2]|0; //@line 150 "../../src/imu/imu.c"
 ;HEAP32[$$byval_copy7>>2]=HEAP32[$12>>2]|0;HEAP32[$$byval_copy7+4>>2]=HEAP32[$12+4>>2]|0;HEAP32[$$byval_copy7+8>>2]=HEAP32[$12+8>>2]|0; //@line 152 "../../src/imu/imu.c"
 ;HEAP32[$$byval_copy8>>2]=HEAP32[$10>>2]|0;HEAP32[$$byval_copy8+4>>2]=HEAP32[$10+4>>2]|0;HEAP32[$$byval_copy8+8>>2]=HEAP32[$10+8>>2]|0; //@line 152 "../../src/imu/imu.c"
 _v3_cross_17($14,$$byval_copy7,$$byval_copy8); //@line 152 "../../src/imu/imu.c"
 ;HEAP32[$$byval_copy9>>2]=HEAP32[$14>>2]|0;HEAP32[$$byval_copy9+4>>2]=HEAP32[$14+4>>2]|0;HEAP32[$$byval_copy9+8>>2]=HEAP32[$14+8>>2]|0; //@line 152 "../../src/imu/imu.c"
 _v3_norm_15($13,$$byval_copy9); //@line 152 "../../src/imu/imu.c"
 ;HEAP32[$$byval_copy10>>2]=HEAP32[$13>>2]|0;HEAP32[$$byval_copy10+4>>2]=HEAP32[$13+4>>2]|0;HEAP32[$$byval_copy10+8>>2]=HEAP32[$13+8>>2]|0; //@line 154 "../../src/imu/imu.c"
 ;HEAP32[$$byval_copy11>>2]=HEAP32[$12>>2]|0;HEAP32[$$byval_copy11+4>>2]=HEAP32[$12+4>>2]|0;HEAP32[$$byval_copy11+8>>2]=HEAP32[$12+8>>2]|0; //@line 154 "../../src/imu/imu.c"
 _v3_cross_17($16,$$byval_copy10,$$byval_copy11); //@line 154 "../../src/imu/imu.c"
 ;HEAP32[$$byval_copy12>>2]=HEAP32[$16>>2]|0;HEAP32[$$byval_copy12+4>>2]=HEAP32[$16+4>>2]|0;HEAP32[$$byval_copy12+8>>2]=HEAP32[$16+8>>2]|0; //@line 154 "../../src/imu/imu.c"
 _v3_norm_15($15,$$byval_copy12); //@line 154 "../../src/imu/imu.c"
 $48 = +HEAPF32[$15>>2]; //@line 156 "../../src/imu/imu.c"
 $49 = $48; //@line 156 "../../src/imu/imu.c"
 $50 = ((($15)) + 4|0); //@line 156 "../../src/imu/imu.c"
 $51 = +HEAPF32[$50>>2]; //@line 156 "../../src/imu/imu.c"
 $52 = $51; //@line 156 "../../src/imu/imu.c"
 $53 = (+Math_atan2((+$49),(+$52))); //@line 156 "../../src/imu/imu.c"
 $54 = $53; //@line 156 "../../src/imu/imu.c"
 $55 = (+_radians_to_degrees($54)); //@line 156 "../../src/imu/imu.c"
 $56 = -90.0 + $55; //@line 156 "../../src/imu/imu.c"
 $17 = $56; //@line 156 "../../src/imu/imu.c"
 $57 = ((($12)) + 4|0); //@line 157 "../../src/imu/imu.c"
 $58 = +HEAPF32[$57>>2]; //@line 157 "../../src/imu/imu.c"
 $59 = $58; //@line 157 "../../src/imu/imu.c"
 $60 = +HEAPF32[$12>>2]; //@line 157 "../../src/imu/imu.c"
 $61 = +HEAPF32[$12>>2]; //@line 157 "../../src/imu/imu.c"
 $62 = $60 * $61; //@line 157 "../../src/imu/imu.c"
 $63 = ((($12)) + 8|0); //@line 157 "../../src/imu/imu.c"
 $64 = +HEAPF32[$63>>2]; //@line 157 "../../src/imu/imu.c"
 $65 = ((($12)) + 8|0); //@line 157 "../../src/imu/imu.c"
 $66 = +HEAPF32[$65>>2]; //@line 157 "../../src/imu/imu.c"
 $67 = $64 * $66; //@line 157 "../../src/imu/imu.c"
 $68 = $62 + $67; //@line 157 "../../src/imu/imu.c"
 $69 = $68; //@line 157 "../../src/imu/imu.c"
 $70 = (+Math_sqrt((+$69))); //@line 157 "../../src/imu/imu.c"
 $71 = (+Math_atan2((+$59),(+$70))); //@line 157 "../../src/imu/imu.c"
 $72 = $71 * 180.0; //@line 157 "../../src/imu/imu.c"
 $73 = $72 / 3.1415926535897931; //@line 157 "../../src/imu/imu.c"
 $74 = $73; //@line 157 "../../src/imu/imu.c"
 $18 = $74; //@line 157 "../../src/imu/imu.c"
 $75 = +HEAPF32[$12>>2]; //@line 158 "../../src/imu/imu.c"
 $76 = - $75; //@line 158 "../../src/imu/imu.c"
 $77 = $76; //@line 158 "../../src/imu/imu.c"
 $78 = ((($12)) + 4|0); //@line 158 "../../src/imu/imu.c"
 $79 = +HEAPF32[$78>>2]; //@line 158 "../../src/imu/imu.c"
 $80 = ((($12)) + 4|0); //@line 158 "../../src/imu/imu.c"
 $81 = +HEAPF32[$80>>2]; //@line 158 "../../src/imu/imu.c"
 $82 = $79 * $81; //@line 158 "../../src/imu/imu.c"
 $83 = ((($12)) + 8|0); //@line 158 "../../src/imu/imu.c"
 $84 = +HEAPF32[$83>>2]; //@line 158 "../../src/imu/imu.c"
 $85 = ((($12)) + 8|0); //@line 158 "../../src/imu/imu.c"
 $86 = +HEAPF32[$85>>2]; //@line 158 "../../src/imu/imu.c"
 $87 = $84 * $86; //@line 158 "../../src/imu/imu.c"
 $88 = $82 + $87; //@line 158 "../../src/imu/imu.c"
 $89 = $88; //@line 158 "../../src/imu/imu.c"
 $90 = (+Math_sqrt((+$89))); //@line 158 "../../src/imu/imu.c"
 $91 = (+Math_atan2((+$77),(+$90))); //@line 158 "../../src/imu/imu.c"
 $92 = $91 * 180.0; //@line 158 "../../src/imu/imu.c"
 $93 = $92 / 3.1415926535897931; //@line 158 "../../src/imu/imu.c"
 $94 = $93; //@line 158 "../../src/imu/imu.c"
 $19 = $94; //@line 158 "../../src/imu/imu.c"
 $95 = $17; //@line 159 "../../src/imu/imu.c"
 $96 = $19; //@line 159 "../../src/imu/imu.c"
 $97 = $18; //@line 159 "../../src/imu/imu.c"
 _vec3_10($20,$95,$96,$97); //@line 159 "../../src/imu/imu.c"
 $98 = $4; //@line 160 "../../src/imu/imu.c"
 $99 = ((($98)) + 1376|0); //@line 160 "../../src/imu/imu.c"
 $100 = ((($99)) + 24|0); //@line 160 "../../src/imu/imu.c"
 ;HEAP32[$$byval_copy13>>2]=HEAP32[$100>>2]|0;HEAP32[$$byval_copy13+4>>2]=HEAP32[$100+4>>2]|0;HEAP32[$$byval_copy13+8>>2]=HEAP32[$100+8>>2]|0;HEAP32[$$byval_copy13+12>>2]=HEAP32[$100+12>>2]|0; //@line 160 "../../src/imu/imu.c"
 _heading_pitch_roll_from_quaternion($21,$$byval_copy13); //@line 160 "../../src/imu/imu.c"
 $101 = $4; //@line 162 "../../src/imu/imu.c"
 $102 = ((($101)) + 1440|0); //@line 162 "../../src/imu/imu.c"
 $103 = ((($102)) + 24|0); //@line 162 "../../src/imu/imu.c"
 $104 = +HEAPF32[$20>>2]; //@line 162 "../../src/imu/imu.c"
 $105 = ((($20)) + 4|0); //@line 162 "../../src/imu/imu.c"
 $106 = +HEAPF32[$105>>2]; //@line 162 "../../src/imu/imu.c"
 $107 = ((($20)) + 8|0); //@line 162 "../../src/imu/imu.c"
 $108 = +HEAPF32[$107>>2]; //@line 162 "../../src/imu/imu.c"
 _quaternion_from_heading_pitch_roll($22,$104,$106,$108); //@line 162 "../../src/imu/imu.c"
 $109 = $4; //@line 162 "../../src/imu/imu.c"
 $110 = ((($109)) + 1312|0); //@line 162 "../../src/imu/imu.c"
 $111 = ((($110)) + 24|0); //@line 162 "../../src/imu/imu.c"
 ;HEAP32[$$byval_copy14>>2]=HEAP32[$22>>2]|0;HEAP32[$$byval_copy14+4>>2]=HEAP32[$22+4>>2]|0;HEAP32[$$byval_copy14+8>>2]=HEAP32[$22+8>>2]|0;HEAP32[$$byval_copy14+12>>2]=HEAP32[$22+12>>2]|0; //@line 162 "../../src/imu/imu.c"
 ;HEAP32[$$byval_copy15>>2]=HEAP32[$111>>2]|0;HEAP32[$$byval_copy15+4>>2]=HEAP32[$111+4>>2]|0;HEAP32[$$byval_copy15+8>>2]=HEAP32[$111+8>>2]|0;HEAP32[$$byval_copy15+12>>2]=HEAP32[$111+12>>2]|0; //@line 162 "../../src/imu/imu.c"
 _quaternion_set_sign_like_example($23,$$byval_copy14,$$byval_copy15); //@line 162 "../../src/imu/imu.c"
 ;HEAP32[$103>>2]=HEAP32[$23>>2]|0;HEAP32[$103+4>>2]=HEAP32[$23+4>>2]|0;HEAP32[$103+8>>2]=HEAP32[$23+8>>2]|0;HEAP32[$103+12>>2]=HEAP32[$23+12>>2]|0; //@line 162 "../../src/imu/imu.c"
 $112 = +HEAPF64[$1>>3]; //@line 165 "../../src/imu/imu.c"
 $113 = $5; //@line 165 "../../src/imu/imu.c"
 $114 = $6; //@line 165 "../../src/imu/imu.c"
 $115 = HEAP32[$114>>2]|0; //@line 165 "../../src/imu/imu.c"
 $116 = (($113) + (($115*144)|0)|0); //@line 165 "../../src/imu/imu.c"
 HEAPF64[$116>>3] = $112; //@line 165 "../../src/imu/imu.c"
 $117 = $5; //@line 166 "../../src/imu/imu.c"
 $118 = $6; //@line 166 "../../src/imu/imu.c"
 $119 = HEAP32[$118>>2]|0; //@line 166 "../../src/imu/imu.c"
 $120 = (($117) + (($119*144)|0)|0); //@line 166 "../../src/imu/imu.c"
 $121 = ((($120)) + 8|0); //@line 166 "../../src/imu/imu.c"
 HEAP32[$121>>2] = 2001; //@line 166 "../../src/imu/imu.c"
 $24 = 0; //@line 167 "../../src/imu/imu.c"
 $122 = $4; //@line 168 "../../src/imu/imu.c"
 $123 = ((($122)) + 1440|0); //@line 168 "../../src/imu/imu.c"
 $124 = ((($123)) + 24|0); //@line 168 "../../src/imu/imu.c"
 $125 = $4; //@line 168 "../../src/imu/imu.c"
 $126 = ((($125)) + 1376|0); //@line 168 "../../src/imu/imu.c"
 $127 = ((($126)) + 24|0); //@line 168 "../../src/imu/imu.c"
 ;HEAP32[$$byval_copy16>>2]=HEAP32[$124>>2]|0;HEAP32[$$byval_copy16+4>>2]=HEAP32[$124+4>>2]|0;HEAP32[$$byval_copy16+8>>2]=HEAP32[$124+8>>2]|0;HEAP32[$$byval_copy16+12>>2]=HEAP32[$124+12>>2]|0; //@line 168 "../../src/imu/imu.c"
 ;HEAP32[$$byval_copy17>>2]=HEAP32[$127>>2]|0;HEAP32[$$byval_copy17+4>>2]=HEAP32[$127+4>>2]|0;HEAP32[$$byval_copy17+8>>2]=HEAP32[$127+8>>2]|0;HEAP32[$$byval_copy17+12>>2]=HEAP32[$127+12>>2]|0; //@line 168 "../../src/imu/imu.c"
 $128 = (+_compare_pitch_and_roll($$byval_copy16,$$byval_copy17)); //@line 168 "../../src/imu/imu.c"
 $129 = $128; //@line 168 "../../src/imu/imu.c"
 $130 = $5; //@line 168 "../../src/imu/imu.c"
 $131 = $6; //@line 168 "../../src/imu/imu.c"
 $132 = HEAP32[$131>>2]|0; //@line 168 "../../src/imu/imu.c"
 $133 = (($130) + (($132*144)|0)|0); //@line 168 "../../src/imu/imu.c"
 $134 = ((($133)) + 16|0); //@line 168 "../../src/imu/imu.c"
 $135 = $24; //@line 168 "../../src/imu/imu.c"
 $136 = (($135) + 1)|0; //@line 168 "../../src/imu/imu.c"
 $24 = $136; //@line 168 "../../src/imu/imu.c"
 $137 = (($134) + ($135<<3)|0); //@line 168 "../../src/imu/imu.c"
 HEAPF64[$137>>3] = $129; //@line 168 "../../src/imu/imu.c"
 $138 = +HEAPF32[$20>>2]; //@line 169 "../../src/imu/imu.c"
 $139 = $138; //@line 169 "../../src/imu/imu.c"
 $140 = $5; //@line 169 "../../src/imu/imu.c"
 $141 = $6; //@line 169 "../../src/imu/imu.c"
 $142 = HEAP32[$141>>2]|0; //@line 169 "../../src/imu/imu.c"
 $143 = (($140) + (($142*144)|0)|0); //@line 169 "../../src/imu/imu.c"
 $144 = ((($143)) + 16|0); //@line 169 "../../src/imu/imu.c"
 $145 = $24; //@line 169 "../../src/imu/imu.c"
 $146 = (($145) + 1)|0; //@line 169 "../../src/imu/imu.c"
 $24 = $146; //@line 169 "../../src/imu/imu.c"
 $147 = (($144) + ($145<<3)|0); //@line 169 "../../src/imu/imu.c"
 HEAPF64[$147>>3] = $139; //@line 169 "../../src/imu/imu.c"
 $148 = ((($20)) + 4|0); //@line 170 "../../src/imu/imu.c"
 $149 = +HEAPF32[$148>>2]; //@line 170 "../../src/imu/imu.c"
 $150 = $149; //@line 170 "../../src/imu/imu.c"
 $151 = $5; //@line 170 "../../src/imu/imu.c"
 $152 = $6; //@line 170 "../../src/imu/imu.c"
 $153 = HEAP32[$152>>2]|0; //@line 170 "../../src/imu/imu.c"
 $154 = (($151) + (($153*144)|0)|0); //@line 170 "../../src/imu/imu.c"
 $155 = ((($154)) + 16|0); //@line 170 "../../src/imu/imu.c"
 $156 = $24; //@line 170 "../../src/imu/imu.c"
 $157 = (($156) + 1)|0; //@line 170 "../../src/imu/imu.c"
 $24 = $157; //@line 170 "../../src/imu/imu.c"
 $158 = (($155) + ($156<<3)|0); //@line 170 "../../src/imu/imu.c"
 HEAPF64[$158>>3] = $150; //@line 170 "../../src/imu/imu.c"
 $159 = ((($20)) + 8|0); //@line 171 "../../src/imu/imu.c"
 $160 = +HEAPF32[$159>>2]; //@line 171 "../../src/imu/imu.c"
 $161 = $160; //@line 171 "../../src/imu/imu.c"
 $162 = $5; //@line 171 "../../src/imu/imu.c"
 $163 = $6; //@line 171 "../../src/imu/imu.c"
 $164 = HEAP32[$163>>2]|0; //@line 171 "../../src/imu/imu.c"
 $165 = (($162) + (($164*144)|0)|0); //@line 171 "../../src/imu/imu.c"
 $166 = ((($165)) + 16|0); //@line 171 "../../src/imu/imu.c"
 $167 = $24; //@line 171 "../../src/imu/imu.c"
 $168 = (($167) + 1)|0; //@line 171 "../../src/imu/imu.c"
 $24 = $168; //@line 171 "../../src/imu/imu.c"
 $169 = (($166) + ($167<<3)|0); //@line 171 "../../src/imu/imu.c"
 HEAPF64[$169>>3] = $161; //@line 171 "../../src/imu/imu.c"
 $170 = +HEAPF32[$21>>2]; //@line 172 "../../src/imu/imu.c"
 $171 = $170; //@line 172 "../../src/imu/imu.c"
 $172 = $5; //@line 172 "../../src/imu/imu.c"
 $173 = $6; //@line 172 "../../src/imu/imu.c"
 $174 = HEAP32[$173>>2]|0; //@line 172 "../../src/imu/imu.c"
 $175 = (($172) + (($174*144)|0)|0); //@line 172 "../../src/imu/imu.c"
 $176 = ((($175)) + 16|0); //@line 172 "../../src/imu/imu.c"
 $177 = $24; //@line 172 "../../src/imu/imu.c"
 $178 = (($177) + 1)|0; //@line 172 "../../src/imu/imu.c"
 $24 = $178; //@line 172 "../../src/imu/imu.c"
 $179 = (($176) + ($177<<3)|0); //@line 172 "../../src/imu/imu.c"
 HEAPF64[$179>>3] = $171; //@line 172 "../../src/imu/imu.c"
 $180 = ((($21)) + 4|0); //@line 173 "../../src/imu/imu.c"
 $181 = +HEAPF32[$180>>2]; //@line 173 "../../src/imu/imu.c"
 $182 = $181; //@line 173 "../../src/imu/imu.c"
 $183 = $5; //@line 173 "../../src/imu/imu.c"
 $184 = $6; //@line 173 "../../src/imu/imu.c"
 $185 = HEAP32[$184>>2]|0; //@line 173 "../../src/imu/imu.c"
 $186 = (($183) + (($185*144)|0)|0); //@line 173 "../../src/imu/imu.c"
 $187 = ((($186)) + 16|0); //@line 173 "../../src/imu/imu.c"
 $188 = $24; //@line 173 "../../src/imu/imu.c"
 $189 = (($188) + 1)|0; //@line 173 "../../src/imu/imu.c"
 $24 = $189; //@line 173 "../../src/imu/imu.c"
 $190 = (($187) + ($188<<3)|0); //@line 173 "../../src/imu/imu.c"
 HEAPF64[$190>>3] = $182; //@line 173 "../../src/imu/imu.c"
 $191 = ((($21)) + 8|0); //@line 174 "../../src/imu/imu.c"
 $192 = +HEAPF32[$191>>2]; //@line 174 "../../src/imu/imu.c"
 $193 = $192; //@line 174 "../../src/imu/imu.c"
 $194 = $5; //@line 174 "../../src/imu/imu.c"
 $195 = $6; //@line 174 "../../src/imu/imu.c"
 $196 = HEAP32[$195>>2]|0; //@line 174 "../../src/imu/imu.c"
 $197 = (($194) + (($196*144)|0)|0); //@line 174 "../../src/imu/imu.c"
 $198 = ((($197)) + 16|0); //@line 174 "../../src/imu/imu.c"
 $199 = $24; //@line 174 "../../src/imu/imu.c"
 $200 = (($199) + 1)|0; //@line 174 "../../src/imu/imu.c"
 $24 = $200; //@line 174 "../../src/imu/imu.c"
 $201 = (($198) + ($199<<3)|0); //@line 174 "../../src/imu/imu.c"
 HEAPF64[$201>>3] = $193; //@line 174 "../../src/imu/imu.c"
 $202 = $24; //@line 175 "../../src/imu/imu.c"
 $203 = $5; //@line 175 "../../src/imu/imu.c"
 $204 = $6; //@line 175 "../../src/imu/imu.c"
 $205 = HEAP32[$204>>2]|0; //@line 175 "../../src/imu/imu.c"
 $206 = (($203) + (($205*144)|0)|0); //@line 175 "../../src/imu/imu.c"
 $207 = ((($206)) + 12|0); //@line 175 "../../src/imu/imu.c"
 HEAP32[$207>>2] = $202; //@line 175 "../../src/imu/imu.c"
 $208 = $6; //@line 176 "../../src/imu/imu.c"
 $209 = HEAP32[$208>>2]|0; //@line 176 "../../src/imu/imu.c"
 $210 = (($209) + 1)|0; //@line 176 "../../src/imu/imu.c"
 HEAP32[$208>>2] = $210; //@line 176 "../../src/imu/imu.c"
 $211 = $4; //@line 179 "../../src/imu/imu.c"
 $212 = ((($211)) + 1168|0); //@line 179 "../../src/imu/imu.c"
 $213 = +HEAPF64[$212>>3]; //@line 179 "../../src/imu/imu.c"
 $214 = $213 == 0.0; //@line 179 "../../src/imu/imu.c"
 if ($214) {
  $215 = $4; //@line 182 "../../src/imu/imu.c"
  $216 = ((($215)) + 1312|0); //@line 182 "../../src/imu/imu.c"
  $217 = ((($216)) + 24|0); //@line 182 "../../src/imu/imu.c"
  $218 = $4; //@line 182 "../../src/imu/imu.c"
  $219 = ((($218)) + 1440|0); //@line 182 "../../src/imu/imu.c"
  $220 = ((($219)) + 24|0); //@line 182 "../../src/imu/imu.c"
  ;HEAP32[$217>>2]=HEAP32[$220>>2]|0;HEAP32[$217+4>>2]=HEAP32[$220+4>>2]|0;HEAP32[$217+8>>2]=HEAP32[$220+8>>2]|0;HEAP32[$217+12>>2]=HEAP32[$220+12>>2]|0; //@line 182 "../../src/imu/imu.c"
  $221 = $4; //@line 185 "../../src/imu/imu.c"
  $222 = ((($221)) + 1312|0); //@line 185 "../../src/imu/imu.c"
  $223 = ((($222)) + 24|0); //@line 185 "../../src/imu/imu.c"
  $224 = ((($223)) + 4|0); //@line 185 "../../src/imu/imu.c"
  $225 = +HEAPF32[$224>>2]; //@line 185 "../../src/imu/imu.c"
  $226 = $225; //@line 185 "../../src/imu/imu.c"
  HEAPF64[$25>>3] = $226; //@line 185 "../../src/imu/imu.c"
  $227 = $4; //@line 186 "../../src/imu/imu.c"
  $228 = ((($227)) + 1312|0); //@line 186 "../../src/imu/imu.c"
  $229 = ((($228)) + 24|0); //@line 186 "../../src/imu/imu.c"
  $230 = ((($229)) + 8|0); //@line 186 "../../src/imu/imu.c"
  $231 = +HEAPF32[$230>>2]; //@line 186 "../../src/imu/imu.c"
  $232 = $231; //@line 186 "../../src/imu/imu.c"
  $233 = ((($25)) + 8|0); //@line 186 "../../src/imu/imu.c"
  HEAPF64[$233>>3] = $232; //@line 186 "../../src/imu/imu.c"
  $234 = $4; //@line 187 "../../src/imu/imu.c"
  $235 = ((($234)) + 1312|0); //@line 187 "../../src/imu/imu.c"
  $236 = ((($235)) + 24|0); //@line 187 "../../src/imu/imu.c"
  $237 = ((($236)) + 12|0); //@line 187 "../../src/imu/imu.c"
  $238 = +HEAPF32[$237>>2]; //@line 187 "../../src/imu/imu.c"
  $239 = $238; //@line 187 "../../src/imu/imu.c"
  $240 = ((($25)) + 16|0); //@line 187 "../../src/imu/imu.c"
  HEAPF64[$240>>3] = $239; //@line 187 "../../src/imu/imu.c"
  $241 = $4; //@line 188 "../../src/imu/imu.c"
  $242 = ((($241)) + 56|0); //@line 188 "../../src/imu/imu.c"
  $243 = $4; //@line 188 "../../src/imu/imu.c"
  $244 = ((($243)) + 1176|0); //@line 188 "../../src/imu/imu.c"
  $245 = +HEAPF64[$244>>3]; //@line 188 "../../src/imu/imu.c"
  _imu_ekf_init($242,$245,$25); //@line 188 "../../src/imu/imu.c"
  $246 = +HEAPF64[$1>>3]; //@line 189 "../../src/imu/imu.c"
  $247 = $4; //@line 189 "../../src/imu/imu.c"
  $248 = ((($247)) + 1168|0); //@line 189 "../../src/imu/imu.c"
  HEAPF64[$248>>3] = $246; //@line 189 "../../src/imu/imu.c"
 }
 $249 = +HEAPF64[$1>>3]; //@line 192 "../../src/imu/imu.c"
 $250 = $4; //@line 192 "../../src/imu/imu.c"
 $251 = ((($250)) + 1168|0); //@line 192 "../../src/imu/imu.c"
 $252 = +HEAPF64[$251>>3]; //@line 192 "../../src/imu/imu.c"
 $253 = $249 - $252; //@line 192 "../../src/imu/imu.c"
 $254 = $4; //@line 192 "../../src/imu/imu.c"
 $255 = ((($254)) + 1184|0); //@line 192 "../../src/imu/imu.c"
 $256 = +HEAPF64[$255>>3]; //@line 192 "../../src/imu/imu.c"
 $257 = 1000.0 * $256; //@line 192 "../../src/imu/imu.c"
 $258 = $253 > $257; //@line 192 "../../src/imu/imu.c"
 if ($258) {
  $259 = +HEAPF64[$1>>3]; //@line 194 "../../src/imu/imu.c"
  $260 = $4; //@line 194 "../../src/imu/imu.c"
  $261 = ((($260)) + 1168|0); //@line 194 "../../src/imu/imu.c"
  HEAPF64[$261>>3] = $259; //@line 194 "../../src/imu/imu.c"
  $262 = $4; //@line 196 "../../src/imu/imu.c"
  $263 = ((($262)) + 1440|0); //@line 196 "../../src/imu/imu.c"
  $264 = ((($263)) + 24|0); //@line 196 "../../src/imu/imu.c"
  $265 = ((($264)) + 4|0); //@line 196 "../../src/imu/imu.c"
  $266 = +HEAPF32[$265>>2]; //@line 196 "../../src/imu/imu.c"
  $267 = $266; //@line 196 "../../src/imu/imu.c"
  HEAPF64[$26>>3] = $267; //@line 196 "../../src/imu/imu.c"
  $268 = $4; //@line 197 "../../src/imu/imu.c"
  $269 = ((($268)) + 1440|0); //@line 197 "../../src/imu/imu.c"
  $270 = ((($269)) + 24|0); //@line 197 "../../src/imu/imu.c"
  $271 = ((($270)) + 8|0); //@line 197 "../../src/imu/imu.c"
  $272 = +HEAPF32[$271>>2]; //@line 197 "../../src/imu/imu.c"
  $273 = $272; //@line 197 "../../src/imu/imu.c"
  $274 = ((($26)) + 8|0); //@line 197 "../../src/imu/imu.c"
  HEAPF64[$274>>3] = $273; //@line 197 "../../src/imu/imu.c"
  $275 = $4; //@line 198 "../../src/imu/imu.c"
  $276 = ((($275)) + 1440|0); //@line 198 "../../src/imu/imu.c"
  $277 = ((($276)) + 24|0); //@line 198 "../../src/imu/imu.c"
  $278 = ((($277)) + 12|0); //@line 198 "../../src/imu/imu.c"
  $279 = +HEAPF32[$278>>2]; //@line 198 "../../src/imu/imu.c"
  $280 = $279; //@line 198 "../../src/imu/imu.c"
  $281 = ((($26)) + 16|0); //@line 198 "../../src/imu/imu.c"
  HEAPF64[$281>>3] = $280; //@line 198 "../../src/imu/imu.c"
  $282 = $4; //@line 203 "../../src/imu/imu.c"
  $283 = ((($282)) + 56|0); //@line 203 "../../src/imu/imu.c"
  (_imu_ekf_update($283,$26)|0); //@line 203 "../../src/imu/imu.c"
  $284 = +HEAPF64[$1>>3]; //@line 204 "../../src/imu/imu.c"
  $285 = $5; //@line 204 "../../src/imu/imu.c"
  $286 = $6; //@line 204 "../../src/imu/imu.c"
  $287 = HEAP32[$286>>2]|0; //@line 204 "../../src/imu/imu.c"
  $288 = (($285) + (($287*144)|0)|0); //@line 204 "../../src/imu/imu.c"
  HEAPF64[$288>>3] = $284; //@line 204 "../../src/imu/imu.c"
  $289 = $5; //@line 205 "../../src/imu/imu.c"
  $290 = $6; //@line 205 "../../src/imu/imu.c"
  $291 = HEAP32[$290>>2]|0; //@line 205 "../../src/imu/imu.c"
  $292 = (($289) + (($291*144)|0)|0); //@line 205 "../../src/imu/imu.c"
  $293 = ((($292)) + 8|0); //@line 205 "../../src/imu/imu.c"
  HEAP32[$293>>2] = 2002; //@line 205 "../../src/imu/imu.c"
  $24 = 0; //@line 206 "../../src/imu/imu.c"
  $294 = $4; //@line 207 "../../src/imu/imu.c"
  $295 = ((($294)) + 1440|0); //@line 207 "../../src/imu/imu.c"
  $296 = ((($295)) + 24|0); //@line 207 "../../src/imu/imu.c"
  $297 = $4; //@line 207 "../../src/imu/imu.c"
  $298 = ((($297)) + 1312|0); //@line 207 "../../src/imu/imu.c"
  $299 = ((($298)) + 24|0); //@line 207 "../../src/imu/imu.c"
  ;HEAP32[$$byval_copy18>>2]=HEAP32[$299>>2]|0;HEAP32[$$byval_copy18+4>>2]=HEAP32[$299+4>>2]|0;HEAP32[$$byval_copy18+8>>2]=HEAP32[$299+8>>2]|0;HEAP32[$$byval_copy18+12>>2]=HEAP32[$299+12>>2]|0; //@line 207 "../../src/imu/imu.c"
  _quaternion_inverse($28,$$byval_copy18); //@line 207 "../../src/imu/imu.c"
  ;HEAP32[$$byval_copy19>>2]=HEAP32[$296>>2]|0;HEAP32[$$byval_copy19+4>>2]=HEAP32[$296+4>>2]|0;HEAP32[$$byval_copy19+8>>2]=HEAP32[$296+8>>2]|0;HEAP32[$$byval_copy19+12>>2]=HEAP32[$296+12>>2]|0; //@line 207 "../../src/imu/imu.c"
  ;HEAP32[$$byval_copy20>>2]=HEAP32[$28>>2]|0;HEAP32[$$byval_copy20+4>>2]=HEAP32[$28+4>>2]|0;HEAP32[$$byval_copy20+8>>2]=HEAP32[$28+8>>2]|0;HEAP32[$$byval_copy20+12>>2]=HEAP32[$28+12>>2]|0; //@line 207 "../../src/imu/imu.c"
  _quaternion_multiply_14($27,$$byval_copy19,$$byval_copy20); //@line 207 "../../src/imu/imu.c"
  ;HEAP32[$$byval_copy21>>2]=HEAP32[$27>>2]|0;HEAP32[$$byval_copy21+4>>2]=HEAP32[$27+4>>2]|0;HEAP32[$$byval_copy21+8>>2]=HEAP32[$27+8>>2]|0;HEAP32[$$byval_copy21+12>>2]=HEAP32[$27+12>>2]|0; //@line 207 "../../src/imu/imu.c"
  $300 = (+_quaternion_angle($$byval_copy21)); //@line 207 "../../src/imu/imu.c"
  $301 = $300; //@line 207 "../../src/imu/imu.c"
  $302 = $5; //@line 207 "../../src/imu/imu.c"
  $303 = $6; //@line 207 "../../src/imu/imu.c"
  $304 = HEAP32[$303>>2]|0; //@line 207 "../../src/imu/imu.c"
  $305 = (($302) + (($304*144)|0)|0); //@line 207 "../../src/imu/imu.c"
  $306 = ((($305)) + 16|0); //@line 207 "../../src/imu/imu.c"
  $307 = $24; //@line 207 "../../src/imu/imu.c"
  $308 = (($307) + 1)|0; //@line 207 "../../src/imu/imu.c"
  $24 = $308; //@line 207 "../../src/imu/imu.c"
  $309 = (($306) + ($307<<3)|0); //@line 207 "../../src/imu/imu.c"
  HEAPF64[$309>>3] = $301; //@line 207 "../../src/imu/imu.c"
  $310 = $4; //@line 208 "../../src/imu/imu.c"
  $311 = ((($310)) + 1440|0); //@line 208 "../../src/imu/imu.c"
  $312 = ((($311)) + 24|0); //@line 208 "../../src/imu/imu.c"
  $313 = ((($312)) + 4|0); //@line 208 "../../src/imu/imu.c"
  $314 = +HEAPF32[$313>>2]; //@line 208 "../../src/imu/imu.c"
  $315 = $314; //@line 208 "../../src/imu/imu.c"
  $316 = $5; //@line 208 "../../src/imu/imu.c"
  $317 = $6; //@line 208 "../../src/imu/imu.c"
  $318 = HEAP32[$317>>2]|0; //@line 208 "../../src/imu/imu.c"
  $319 = (($316) + (($318*144)|0)|0); //@line 208 "../../src/imu/imu.c"
  $320 = ((($319)) + 16|0); //@line 208 "../../src/imu/imu.c"
  $321 = $24; //@line 208 "../../src/imu/imu.c"
  $322 = (($321) + 1)|0; //@line 208 "../../src/imu/imu.c"
  $24 = $322; //@line 208 "../../src/imu/imu.c"
  $323 = (($320) + ($321<<3)|0); //@line 208 "../../src/imu/imu.c"
  HEAPF64[$323>>3] = $315; //@line 208 "../../src/imu/imu.c"
  $324 = $4; //@line 209 "../../src/imu/imu.c"
  $325 = ((($324)) + 1440|0); //@line 209 "../../src/imu/imu.c"
  $326 = ((($325)) + 24|0); //@line 209 "../../src/imu/imu.c"
  $327 = ((($326)) + 8|0); //@line 209 "../../src/imu/imu.c"
  $328 = +HEAPF32[$327>>2]; //@line 209 "../../src/imu/imu.c"
  $329 = $328; //@line 209 "../../src/imu/imu.c"
  $330 = $5; //@line 209 "../../src/imu/imu.c"
  $331 = $6; //@line 209 "../../src/imu/imu.c"
  $332 = HEAP32[$331>>2]|0; //@line 209 "../../src/imu/imu.c"
  $333 = (($330) + (($332*144)|0)|0); //@line 209 "../../src/imu/imu.c"
  $334 = ((($333)) + 16|0); //@line 209 "../../src/imu/imu.c"
  $335 = $24; //@line 209 "../../src/imu/imu.c"
  $336 = (($335) + 1)|0; //@line 209 "../../src/imu/imu.c"
  $24 = $336; //@line 209 "../../src/imu/imu.c"
  $337 = (($334) + ($335<<3)|0); //@line 209 "../../src/imu/imu.c"
  HEAPF64[$337>>3] = $329; //@line 209 "../../src/imu/imu.c"
  $338 = $4; //@line 210 "../../src/imu/imu.c"
  $339 = ((($338)) + 1440|0); //@line 210 "../../src/imu/imu.c"
  $340 = ((($339)) + 24|0); //@line 210 "../../src/imu/imu.c"
  $341 = ((($340)) + 12|0); //@line 210 "../../src/imu/imu.c"
  $342 = +HEAPF32[$341>>2]; //@line 210 "../../src/imu/imu.c"
  $343 = $342; //@line 210 "../../src/imu/imu.c"
  $344 = $5; //@line 210 "../../src/imu/imu.c"
  $345 = $6; //@line 210 "../../src/imu/imu.c"
  $346 = HEAP32[$345>>2]|0; //@line 210 "../../src/imu/imu.c"
  $347 = (($344) + (($346*144)|0)|0); //@line 210 "../../src/imu/imu.c"
  $348 = ((($347)) + 16|0); //@line 210 "../../src/imu/imu.c"
  $349 = $24; //@line 210 "../../src/imu/imu.c"
  $350 = (($349) + 1)|0; //@line 210 "../../src/imu/imu.c"
  $24 = $350; //@line 210 "../../src/imu/imu.c"
  $351 = (($348) + ($349<<3)|0); //@line 210 "../../src/imu/imu.c"
  HEAPF64[$351>>3] = $343; //@line 210 "../../src/imu/imu.c"
  $352 = $4; //@line 211 "../../src/imu/imu.c"
  $353 = ((($352)) + 1312|0); //@line 211 "../../src/imu/imu.c"
  $354 = ((($353)) + 24|0); //@line 211 "../../src/imu/imu.c"
  $355 = ((($354)) + 4|0); //@line 211 "../../src/imu/imu.c"
  $356 = +HEAPF32[$355>>2]; //@line 211 "../../src/imu/imu.c"
  $357 = $356; //@line 211 "../../src/imu/imu.c"
  $358 = $5; //@line 211 "../../src/imu/imu.c"
  $359 = $6; //@line 211 "../../src/imu/imu.c"
  $360 = HEAP32[$359>>2]|0; //@line 211 "../../src/imu/imu.c"
  $361 = (($358) + (($360*144)|0)|0); //@line 211 "../../src/imu/imu.c"
  $362 = ((($361)) + 16|0); //@line 211 "../../src/imu/imu.c"
  $363 = $24; //@line 211 "../../src/imu/imu.c"
  $364 = (($363) + 1)|0; //@line 211 "../../src/imu/imu.c"
  $24 = $364; //@line 211 "../../src/imu/imu.c"
  $365 = (($362) + ($363<<3)|0); //@line 211 "../../src/imu/imu.c"
  HEAPF64[$365>>3] = $357; //@line 211 "../../src/imu/imu.c"
  $366 = $4; //@line 212 "../../src/imu/imu.c"
  $367 = ((($366)) + 1312|0); //@line 212 "../../src/imu/imu.c"
  $368 = ((($367)) + 24|0); //@line 212 "../../src/imu/imu.c"
  $369 = ((($368)) + 8|0); //@line 212 "../../src/imu/imu.c"
  $370 = +HEAPF32[$369>>2]; //@line 212 "../../src/imu/imu.c"
  $371 = $370; //@line 212 "../../src/imu/imu.c"
  $372 = $5; //@line 212 "../../src/imu/imu.c"
  $373 = $6; //@line 212 "../../src/imu/imu.c"
  $374 = HEAP32[$373>>2]|0; //@line 212 "../../src/imu/imu.c"
  $375 = (($372) + (($374*144)|0)|0); //@line 212 "../../src/imu/imu.c"
  $376 = ((($375)) + 16|0); //@line 212 "../../src/imu/imu.c"
  $377 = $24; //@line 212 "../../src/imu/imu.c"
  $378 = (($377) + 1)|0; //@line 212 "../../src/imu/imu.c"
  $24 = $378; //@line 212 "../../src/imu/imu.c"
  $379 = (($376) + ($377<<3)|0); //@line 212 "../../src/imu/imu.c"
  HEAPF64[$379>>3] = $371; //@line 212 "../../src/imu/imu.c"
  $380 = $4; //@line 213 "../../src/imu/imu.c"
  $381 = ((($380)) + 1312|0); //@line 213 "../../src/imu/imu.c"
  $382 = ((($381)) + 24|0); //@line 213 "../../src/imu/imu.c"
  $383 = ((($382)) + 12|0); //@line 213 "../../src/imu/imu.c"
  $384 = +HEAPF32[$383>>2]; //@line 213 "../../src/imu/imu.c"
  $385 = $384; //@line 213 "../../src/imu/imu.c"
  $386 = $5; //@line 213 "../../src/imu/imu.c"
  $387 = $6; //@line 213 "../../src/imu/imu.c"
  $388 = HEAP32[$387>>2]|0; //@line 213 "../../src/imu/imu.c"
  $389 = (($386) + (($388*144)|0)|0); //@line 213 "../../src/imu/imu.c"
  $390 = ((($389)) + 16|0); //@line 213 "../../src/imu/imu.c"
  $391 = $24; //@line 213 "../../src/imu/imu.c"
  $392 = (($391) + 1)|0; //@line 213 "../../src/imu/imu.c"
  $24 = $392; //@line 213 "../../src/imu/imu.c"
  $393 = (($390) + ($391<<3)|0); //@line 213 "../../src/imu/imu.c"
  HEAPF64[$393>>3] = $385; //@line 213 "../../src/imu/imu.c"
  $394 = $24; //@line 214 "../../src/imu/imu.c"
  $395 = $5; //@line 214 "../../src/imu/imu.c"
  $396 = $6; //@line 214 "../../src/imu/imu.c"
  $397 = HEAP32[$396>>2]|0; //@line 214 "../../src/imu/imu.c"
  $398 = (($395) + (($397*144)|0)|0); //@line 214 "../../src/imu/imu.c"
  $399 = ((($398)) + 12|0); //@line 214 "../../src/imu/imu.c"
  HEAP32[$399>>2] = $394; //@line 214 "../../src/imu/imu.c"
  $400 = $6; //@line 215 "../../src/imu/imu.c"
  $401 = HEAP32[$400>>2]|0; //@line 215 "../../src/imu/imu.c"
  $402 = (($401) + 1)|0; //@line 215 "../../src/imu/imu.c"
  HEAP32[$400>>2] = $402; //@line 215 "../../src/imu/imu.c"
  STACKTOP = sp;return; //@line 223 "../../src/imu/imu.c"
 } else {
  $403 = $4; //@line 219 "../../src/imu/imu.c"
  $404 = ((($403)) + 1312|0); //@line 219 "../../src/imu/imu.c"
  $405 = ((($404)) + 24|0); //@line 219 "../../src/imu/imu.c"
  $406 = ((($405)) + 4|0); //@line 219 "../../src/imu/imu.c"
  $407 = +HEAPF32[$406>>2]; //@line 219 "../../src/imu/imu.c"
  $408 = $407; //@line 219 "../../src/imu/imu.c"
  $409 = $4; //@line 219 "../../src/imu/imu.c"
  $410 = ((($409)) + 56|0); //@line 219 "../../src/imu/imu.c"
  $411 = ((($410)) + 8|0); //@line 219 "../../src/imu/imu.c"
  HEAPF64[$411>>3] = $408; //@line 219 "../../src/imu/imu.c"
  $412 = $4; //@line 220 "../../src/imu/imu.c"
  $413 = ((($412)) + 1312|0); //@line 220 "../../src/imu/imu.c"
  $414 = ((($413)) + 24|0); //@line 220 "../../src/imu/imu.c"
  $415 = ((($414)) + 8|0); //@line 220 "../../src/imu/imu.c"
  $416 = +HEAPF32[$415>>2]; //@line 220 "../../src/imu/imu.c"
  $417 = $416; //@line 220 "../../src/imu/imu.c"
  $418 = $4; //@line 220 "../../src/imu/imu.c"
  $419 = ((($418)) + 56|0); //@line 220 "../../src/imu/imu.c"
  $420 = ((($419)) + 8|0); //@line 220 "../../src/imu/imu.c"
  $421 = ((($420)) + 8|0); //@line 220 "../../src/imu/imu.c"
  HEAPF64[$421>>3] = $417; //@line 220 "../../src/imu/imu.c"
  $422 = $4; //@line 221 "../../src/imu/imu.c"
  $423 = ((($422)) + 1312|0); //@line 221 "../../src/imu/imu.c"
  $424 = ((($423)) + 24|0); //@line 221 "../../src/imu/imu.c"
  $425 = ((($424)) + 12|0); //@line 221 "../../src/imu/imu.c"
  $426 = +HEAPF32[$425>>2]; //@line 221 "../../src/imu/imu.c"
  $427 = $426; //@line 221 "../../src/imu/imu.c"
  $428 = $4; //@line 221 "../../src/imu/imu.c"
  $429 = ((($428)) + 56|0); //@line 221 "../../src/imu/imu.c"
  $430 = ((($429)) + 8|0); //@line 221 "../../src/imu/imu.c"
  $431 = ((($430)) + 16|0); //@line 221 "../../src/imu/imu.c"
  HEAPF64[$431>>3] = $427; //@line 221 "../../src/imu/imu.c"
  STACKTOP = sp;return; //@line 223 "../../src/imu/imu.c"
 }
}
function _v3_cross_17($0,$1,$2) {
 $0 = $0|0;
 $1 = $1|0;
 $2 = $2|0;
 var $10 = 0, $11 = 0.0, $12 = 0.0, $13 = 0.0, $14 = 0, $15 = 0, $16 = 0.0, $17 = 0.0, $18 = 0.0, $19 = 0.0, $20 = 0, $21 = 0.0, $22 = 0.0, $23 = 0.0, $24 = 0, $25 = 0.0, $26 = 0, $27 = 0.0, $28 = 0.0, $29 = 0;
 var $3 = 0, $30 = 0.0, $31 = 0.0, $32 = 0.0, $33 = 0.0, $4 = 0.0, $5 = 0, $6 = 0.0, $7 = 0.0, $8 = 0, $9 = 0.0, label = 0, sp = 0;
 sp = STACKTOP;
 $3 = ((($1)) + 4|0); //@line 220 "../../src/imu/../quaternion/../math3d/math_3d.h"
 $4 = +HEAPF32[$3>>2]; //@line 220 "../../src/imu/../quaternion/../math3d/math_3d.h"
 $5 = ((($2)) + 8|0); //@line 220 "../../src/imu/../quaternion/../math3d/math_3d.h"
 $6 = +HEAPF32[$5>>2]; //@line 220 "../../src/imu/../quaternion/../math3d/math_3d.h"
 $7 = $4 * $6; //@line 220 "../../src/imu/../quaternion/../math3d/math_3d.h"
 $8 = ((($1)) + 8|0); //@line 220 "../../src/imu/../quaternion/../math3d/math_3d.h"
 $9 = +HEAPF32[$8>>2]; //@line 220 "../../src/imu/../quaternion/../math3d/math_3d.h"
 $10 = ((($2)) + 4|0); //@line 220 "../../src/imu/../quaternion/../math3d/math_3d.h"
 $11 = +HEAPF32[$10>>2]; //@line 220 "../../src/imu/../quaternion/../math3d/math_3d.h"
 $12 = $9 * $11; //@line 220 "../../src/imu/../quaternion/../math3d/math_3d.h"
 $13 = $7 - $12; //@line 220 "../../src/imu/../quaternion/../math3d/math_3d.h"
 HEAPF32[$0>>2] = $13; //@line 219 "../../src/imu/../quaternion/../math3d/math_3d.h"
 $14 = ((($0)) + 4|0); //@line 219 "../../src/imu/../quaternion/../math3d/math_3d.h"
 $15 = ((($1)) + 8|0); //@line 221 "../../src/imu/../quaternion/../math3d/math_3d.h"
 $16 = +HEAPF32[$15>>2]; //@line 221 "../../src/imu/../quaternion/../math3d/math_3d.h"
 $17 = +HEAPF32[$2>>2]; //@line 221 "../../src/imu/../quaternion/../math3d/math_3d.h"
 $18 = $16 * $17; //@line 221 "../../src/imu/../quaternion/../math3d/math_3d.h"
 $19 = +HEAPF32[$1>>2]; //@line 221 "../../src/imu/../quaternion/../math3d/math_3d.h"
 $20 = ((($2)) + 8|0); //@line 221 "../../src/imu/../quaternion/../math3d/math_3d.h"
 $21 = +HEAPF32[$20>>2]; //@line 221 "../../src/imu/../quaternion/../math3d/math_3d.h"
 $22 = $19 * $21; //@line 221 "../../src/imu/../quaternion/../math3d/math_3d.h"
 $23 = $18 - $22; //@line 221 "../../src/imu/../quaternion/../math3d/math_3d.h"
 HEAPF32[$14>>2] = $23; //@line 219 "../../src/imu/../quaternion/../math3d/math_3d.h"
 $24 = ((($0)) + 8|0); //@line 219 "../../src/imu/../quaternion/../math3d/math_3d.h"
 $25 = +HEAPF32[$1>>2]; //@line 222 "../../src/imu/../quaternion/../math3d/math_3d.h"
 $26 = ((($2)) + 4|0); //@line 222 "../../src/imu/../quaternion/../math3d/math_3d.h"
 $27 = +HEAPF32[$26>>2]; //@line 222 "../../src/imu/../quaternion/../math3d/math_3d.h"
 $28 = $25 * $27; //@line 222 "../../src/imu/../quaternion/../math3d/math_3d.h"
 $29 = ((($1)) + 4|0); //@line 222 "../../src/imu/../quaternion/../math3d/math_3d.h"
 $30 = +HEAPF32[$29>>2]; //@line 222 "../../src/imu/../quaternion/../math3d/math_3d.h"
 $31 = +HEAPF32[$2>>2]; //@line 222 "../../src/imu/../quaternion/../math3d/math_3d.h"
 $32 = $30 * $31; //@line 222 "../../src/imu/../quaternion/../math3d/math_3d.h"
 $33 = $28 - $32; //@line 222 "../../src/imu/../quaternion/../math3d/math_3d.h"
 HEAPF32[$24>>2] = $33; //@line 219 "../../src/imu/../quaternion/../math3d/math_3d.h"
 return; //@line 219 "../../src/imu/../quaternion/../math3d/math_3d.h"
}
function _imu_update($0,$1,$2,$3) {
 $0 = $0|0;
 $1 = $1|0;
 $2 = $2|0;
 $3 = $3|0;
 var $$byval_copy = 0, $$byval_copy1 = 0, $$byval_copy2 = 0, $10 = 0, $11 = 0, $12 = 0, $13 = 0, $14 = 0, $15 = 0, $16 = 0, $17 = 0, $18 = 0, $19 = 0, $20 = 0, $21 = 0, $22 = 0, $23 = 0, $24 = 0, $25 = 0, $26 = 0;
 var $27 = 0, $28 = 0, $29 = 0, $30 = 0, $31 = 0, $32 = 0, $4 = 0, $5 = 0, $6 = 0, $7 = 0, $8 = 0, $9 = 0, label = 0, sp = 0;
 sp = STACKTOP;
 STACKTOP = STACKTOP + 608|0; if ((STACKTOP|0) >= (STACK_MAX|0)) abortStackOverflow(608|0);
 $$byval_copy2 = sp + 432|0;
 $$byval_copy1 = sp + 288|0;
 $$byval_copy = sp + 144|0;
 $7 = sp;
 $4 = $0;
 $5 = $2;
 $6 = $3;
 $10 = $6; //@line 273 "../../src/imu/imu.c"
 $11 = HEAP32[$10>>2]|0; //@line 273 "../../src/imu/imu.c"
 $8 = $11; //@line 273 "../../src/imu/imu.c"
 $9 = -1; //@line 275 "../../src/imu/imu.c"
 while(1) {
  $12 = $9; //@line 275 "../../src/imu/imu.c"
  $13 = $8; //@line 275 "../../src/imu/imu.c"
  $14 = ($12|0)<($13|0); //@line 275 "../../src/imu/imu.c"
  if (!($14)) {
   break;
  }
  $15 = $9; //@line 277 "../../src/imu/imu.c"
  $16 = ($15|0)==(-1); //@line 277 "../../src/imu/imu.c"
  if ($16) {
   _memcpy(($7|0),($1|0),144)|0; //@line 279 "../../src/imu/imu.c"
  } else {
   $17 = $5; //@line 283 "../../src/imu/imu.c"
   $18 = $9; //@line 283 "../../src/imu/imu.c"
   $19 = (($17) + (($18*144)|0)|0); //@line 283 "../../src/imu/imu.c"
   _memcpy(($7|0),($19|0),144)|0; //@line 283 "../../src/imu/imu.c"
  }
  $20 = ((($7)) + 8|0); //@line 286 "../../src/imu/imu.c"
  $21 = HEAP32[$20>>2]|0; //@line 286 "../../src/imu/imu.c"
  switch ($21|0) {
  case 1:  {
   $22 = $4; //@line 289 "../../src/imu/imu.c"
   $23 = $5; //@line 289 "../../src/imu/imu.c"
   $24 = $6; //@line 289 "../../src/imu/imu.c"
   _memcpy(($$byval_copy|0),($7|0),144)|0; //@line 289 "../../src/imu/imu.c"
   _imu_update_accelerometer($22,$$byval_copy,$23,$24); //@line 289 "../../src/imu/imu.c"
   break;
  }
  case 2:  {
   $25 = $4; //@line 292 "../../src/imu/imu.c"
   $26 = $5; //@line 292 "../../src/imu/imu.c"
   $27 = $6; //@line 292 "../../src/imu/imu.c"
   _memcpy(($$byval_copy1|0),($7|0),144)|0; //@line 292 "../../src/imu/imu.c"
   _imu_update_magnetic_field($25,$$byval_copy1,$26,$27); //@line 292 "../../src/imu/imu.c"
   break;
  }
  case 4:  {
   $28 = $4; //@line 295 "../../src/imu/imu.c"
   $29 = $5; //@line 295 "../../src/imu/imu.c"
   $30 = $6; //@line 295 "../../src/imu/imu.c"
   _memcpy(($$byval_copy2|0),($7|0),144)|0; //@line 295 "../../src/imu/imu.c"
   _imu_update_gyro($28,$$byval_copy2,$29,$30); //@line 295 "../../src/imu/imu.c"
   break;
  }
  default: {
  }
  }
  $31 = $9; //@line 275 "../../src/imu/imu.c"
  $32 = (($31) + 1)|0; //@line 275 "../../src/imu/imu.c"
  $9 = $32; //@line 275 "../../src/imu/imu.c"
 }
 STACKTOP = sp;return; //@line 299 "../../src/imu/imu.c"
}
function _imu_ekf_init($0,$1,$2) {
 $0 = $0|0;
 $1 = +$1;
 $2 = $2|0;
 var $10 = 0, $11 = 0, $12 = 0, $13 = 0.0, $14 = 0, $15 = 0, $16 = 0, $17 = 0, $18 = 0, $19 = 0, $20 = 0, $21 = 0, $22 = 0, $23 = 0, $24 = 0.0, $25 = 0, $26 = 0, $27 = 0, $28 = 0, $29 = 0;
 var $3 = 0, $30 = 0, $31 = 0, $32 = 0, $33 = 0, $34 = 0, $35 = 0.0, $36 = 0, $37 = 0, $38 = 0, $39 = 0, $4 = 0.0, $40 = 0, $41 = 0, $42 = 0, $43 = 0, $44 = 0, $45 = 0.0, $46 = 0, $47 = 0;
 var $48 = 0, $49 = 0, $5 = 0, $50 = 0.0, $51 = 0, $52 = 0, $53 = 0, $54 = 0, $55 = 0, $56 = 0.0, $57 = 0, $58 = 0, $59 = 0, $6 = 0, $7 = 0.0, $8 = 0.0, $9 = 0, label = 0, sp = 0;
 sp = STACKTOP;
 STACKTOP = STACKTOP + 48|0; if ((STACKTOP|0) >= (STACK_MAX|0)) abortStackOverflow(48|0);
 $3 = $0;
 $4 = $1;
 $5 = $2;
 $10 = $3; //@line 6 "../../src/imu/imu_ekf.c"
 _ekf_init($10,3,3); //@line 6 "../../src/imu/imu_ekf.c"
 $6 = 0; //@line 8 "../../src/imu/imu_ekf.c"
 while(1) {
  $11 = $6; //@line 8 "../../src/imu/imu_ekf.c"
  $12 = ($11|0)<(3); //@line 8 "../../src/imu/imu_ekf.c"
  if (!($12)) {
   break;
  }
  $13 = $4; //@line 10 "../../src/imu/imu_ekf.c"
  $14 = $3; //@line 10 "../../src/imu/imu_ekf.c"
  $15 = ((($14)) + 104|0); //@line 10 "../../src/imu/imu_ekf.c"
  $16 = $6; //@line 10 "../../src/imu/imu_ekf.c"
  $17 = (($15) + (($16*24)|0)|0); //@line 10 "../../src/imu/imu_ekf.c"
  $18 = $6; //@line 10 "../../src/imu/imu_ekf.c"
  $19 = (($17) + ($18<<3)|0); //@line 10 "../../src/imu/imu_ekf.c"
  HEAPF64[$19>>3] = $13; //@line 10 "../../src/imu/imu_ekf.c"
  $20 = $6; //@line 8 "../../src/imu/imu_ekf.c"
  $21 = (($20) + 1)|0; //@line 8 "../../src/imu/imu_ekf.c"
  $6 = $21; //@line 8 "../../src/imu/imu_ekf.c"
 }
 $7 = 0.5; //@line 13 "../../src/imu/imu_ekf.c"
 $8 = 0.5; //@line 14 "../../src/imu/imu_ekf.c"
 $9 = 0; //@line 18 "../../src/imu/imu_ekf.c"
 while(1) {
  $22 = $9; //@line 18 "../../src/imu/imu_ekf.c"
  $23 = ($22|0)<(3); //@line 18 "../../src/imu/imu_ekf.c"
  if (!($23)) {
   break;
  }
  $24 = $7; //@line 19 "../../src/imu/imu_ekf.c"
  $25 = $3; //@line 19 "../../src/imu/imu_ekf.c"
  $26 = ((($25)) + 32|0); //@line 19 "../../src/imu/imu_ekf.c"
  $27 = $9; //@line 19 "../../src/imu/imu_ekf.c"
  $28 = (($26) + (($27*24)|0)|0); //@line 19 "../../src/imu/imu_ekf.c"
  $29 = $9; //@line 19 "../../src/imu/imu_ekf.c"
  $30 = (($28) + ($29<<3)|0); //@line 19 "../../src/imu/imu_ekf.c"
  HEAPF64[$30>>3] = $24; //@line 19 "../../src/imu/imu_ekf.c"
  $31 = $9; //@line 18 "../../src/imu/imu_ekf.c"
  $32 = (($31) + 1)|0; //@line 18 "../../src/imu/imu_ekf.c"
  $9 = $32; //@line 18 "../../src/imu/imu_ekf.c"
 }
 $9 = 0; //@line 21 "../../src/imu/imu_ekf.c"
 while(1) {
  $33 = $9; //@line 21 "../../src/imu/imu_ekf.c"
  $34 = ($33|0)<(3); //@line 21 "../../src/imu/imu_ekf.c"
  if (!($34)) {
   break;
  }
  $35 = $8; //@line 22 "../../src/imu/imu_ekf.c"
  $36 = $3; //@line 22 "../../src/imu/imu_ekf.c"
  $37 = ((($36)) + 176|0); //@line 22 "../../src/imu/imu_ekf.c"
  $38 = $9; //@line 22 "../../src/imu/imu_ekf.c"
  $39 = (($37) + (($38*24)|0)|0); //@line 22 "../../src/imu/imu_ekf.c"
  $40 = $9; //@line 22 "../../src/imu/imu_ekf.c"
  $41 = (($39) + ($40<<3)|0); //@line 22 "../../src/imu/imu_ekf.c"
  HEAPF64[$41>>3] = $35; //@line 22 "../../src/imu/imu_ekf.c"
  $42 = $9; //@line 21 "../../src/imu/imu_ekf.c"
  $43 = (($42) + 1)|0; //@line 21 "../../src/imu/imu_ekf.c"
  $9 = $43; //@line 21 "../../src/imu/imu_ekf.c"
 }
 $44 = $5; //@line 25 "../../src/imu/imu_ekf.c"
 $45 = +HEAPF64[$44>>3]; //@line 25 "../../src/imu/imu_ekf.c"
 $46 = $3; //@line 25 "../../src/imu/imu_ekf.c"
 $47 = ((($46)) + 8|0); //@line 25 "../../src/imu/imu_ekf.c"
 HEAPF64[$47>>3] = $45; //@line 25 "../../src/imu/imu_ekf.c"
 $48 = $5; //@line 26 "../../src/imu/imu_ekf.c"
 $49 = ((($48)) + 8|0); //@line 26 "../../src/imu/imu_ekf.c"
 $50 = +HEAPF64[$49>>3]; //@line 26 "../../src/imu/imu_ekf.c"
 $51 = $3; //@line 26 "../../src/imu/imu_ekf.c"
 $52 = ((($51)) + 8|0); //@line 26 "../../src/imu/imu_ekf.c"
 $53 = ((($52)) + 8|0); //@line 26 "../../src/imu/imu_ekf.c"
 HEAPF64[$53>>3] = $50; //@line 26 "../../src/imu/imu_ekf.c"
 $54 = $5; //@line 27 "../../src/imu/imu_ekf.c"
 $55 = ((($54)) + 16|0); //@line 27 "../../src/imu/imu_ekf.c"
 $56 = +HEAPF64[$55>>3]; //@line 27 "../../src/imu/imu_ekf.c"
 $57 = $3; //@line 27 "../../src/imu/imu_ekf.c"
 $58 = ((($57)) + 8|0); //@line 27 "../../src/imu/imu_ekf.c"
 $59 = ((($58)) + 16|0); //@line 27 "../../src/imu/imu_ekf.c"
 HEAPF64[$59>>3] = $56; //@line 27 "../../src/imu/imu_ekf.c"
 STACKTOP = sp;return; //@line 28 "../../src/imu/imu_ekf.c"
}
function _imu_ekf_update($0,$1) {
 $0 = $0|0;
 $1 = $1|0;
 var $10 = 0, $11 = 0.0, $12 = 0, $13 = 0, $14 = 0, $15 = 0, $16 = 0, $17 = 0, $18 = 0, $19 = 0, $2 = 0, $20 = 0, $21 = 0, $22 = 0, $23 = 0, $24 = 0, $25 = 0, $26 = 0, $27 = 0, $28 = 0;
 var $29 = 0, $3 = 0, $30 = 0, $31 = 0, $32 = 0, $33 = 0, $34 = 0.0, $35 = 0, $36 = 0, $37 = 0, $38 = 0, $39 = 0, $4 = 0, $40 = 0, $41 = 0, $42 = 0, $43 = 0, $44 = 0, $45 = 0, $46 = 0;
 var $47 = 0, $48 = 0, $49 = 0, $5 = 0, $50 = 0, $51 = 0, $52 = 0, $6 = 0, $7 = 0, $8 = 0, $9 = 0, label = 0, sp = 0;
 sp = STACKTOP;
 STACKTOP = STACKTOP + 16|0; if ((STACKTOP|0) >= (STACK_MAX|0)) abortStackOverflow(16|0);
 $2 = $0;
 $3 = $1;
 $4 = 0; //@line 54 "../../src/imu/imu_ekf.c"
 while(1) {
  $5 = $4; //@line 54 "../../src/imu/imu_ekf.c"
  $6 = ($5|0)<(3); //@line 54 "../../src/imu/imu_ekf.c"
  if (!($6)) {
   break;
  }
  $7 = $2; //@line 55 "../../src/imu/imu_ekf.c"
  $8 = ((($7)) + 8|0); //@line 55 "../../src/imu/imu_ekf.c"
  $9 = $4; //@line 55 "../../src/imu/imu_ekf.c"
  $10 = (($8) + ($9<<3)|0); //@line 55 "../../src/imu/imu_ekf.c"
  $11 = +HEAPF64[$10>>3]; //@line 55 "../../src/imu/imu_ekf.c"
  $12 = $2; //@line 55 "../../src/imu/imu_ekf.c"
  $13 = ((($12)) + 680|0); //@line 55 "../../src/imu/imu_ekf.c"
  $14 = $4; //@line 55 "../../src/imu/imu_ekf.c"
  $15 = (($13) + ($14<<3)|0); //@line 55 "../../src/imu/imu_ekf.c"
  HEAPF64[$15>>3] = $11; //@line 55 "../../src/imu/imu_ekf.c"
  $16 = $4; //@line 54 "../../src/imu/imu_ekf.c"
  $17 = (($16) + 1)|0; //@line 54 "../../src/imu/imu_ekf.c"
  $4 = $17; //@line 54 "../../src/imu/imu_ekf.c"
 }
 $4 = 0; //@line 58 "../../src/imu/imu_ekf.c"
 while(1) {
  $18 = $4; //@line 58 "../../src/imu/imu_ekf.c"
  $19 = ($18|0)<(3); //@line 58 "../../src/imu/imu_ekf.c"
  if (!($19)) {
   break;
  }
  $20 = $2; //@line 59 "../../src/imu/imu_ekf.c"
  $21 = ((($20)) + 320|0); //@line 59 "../../src/imu/imu_ekf.c"
  $22 = $4; //@line 59 "../../src/imu/imu_ekf.c"
  $23 = (($21) + (($22*24)|0)|0); //@line 59 "../../src/imu/imu_ekf.c"
  $24 = $4; //@line 59 "../../src/imu/imu_ekf.c"
  $25 = (($23) + ($24<<3)|0); //@line 59 "../../src/imu/imu_ekf.c"
  HEAPF64[$25>>3] = 1.0; //@line 59 "../../src/imu/imu_ekf.c"
  $26 = $4; //@line 58 "../../src/imu/imu_ekf.c"
  $27 = (($26) + 1)|0; //@line 58 "../../src/imu/imu_ekf.c"
  $4 = $27; //@line 58 "../../src/imu/imu_ekf.c"
 }
 $4 = 0; //@line 63 "../../src/imu/imu_ekf.c"
 while(1) {
  $28 = $4; //@line 63 "../../src/imu/imu_ekf.c"
  $29 = ($28|0)<(3); //@line 63 "../../src/imu/imu_ekf.c"
  if (!($29)) {
   break;
  }
  $30 = $2; //@line 64 "../../src/imu/imu_ekf.c"
  $31 = ((($30)) + 8|0); //@line 64 "../../src/imu/imu_ekf.c"
  $32 = $4; //@line 64 "../../src/imu/imu_ekf.c"
  $33 = (($31) + ($32<<3)|0); //@line 64 "../../src/imu/imu_ekf.c"
  $34 = +HEAPF64[$33>>3]; //@line 64 "../../src/imu/imu_ekf.c"
  $35 = $2; //@line 64 "../../src/imu/imu_ekf.c"
  $36 = ((($35)) + 704|0); //@line 64 "../../src/imu/imu_ekf.c"
  $37 = $4; //@line 64 "../../src/imu/imu_ekf.c"
  $38 = (($36) + ($37<<3)|0); //@line 64 "../../src/imu/imu_ekf.c"
  HEAPF64[$38>>3] = $34; //@line 64 "../../src/imu/imu_ekf.c"
  $39 = $4; //@line 63 "../../src/imu/imu_ekf.c"
  $40 = (($39) + 1)|0; //@line 63 "../../src/imu/imu_ekf.c"
  $4 = $40; //@line 63 "../../src/imu/imu_ekf.c"
 }
 $4 = 0; //@line 67 "../../src/imu/imu_ekf.c"
 while(1) {
  $41 = $4; //@line 67 "../../src/imu/imu_ekf.c"
  $42 = ($41|0)<(3); //@line 67 "../../src/imu/imu_ekf.c"
  $43 = $2;
  if (!($42)) {
   break;
  }
  $44 = ((($43)) + 392|0); //@line 68 "../../src/imu/imu_ekf.c"
  $45 = $4; //@line 68 "../../src/imu/imu_ekf.c"
  $46 = (($44) + (($45*24)|0)|0); //@line 68 "../../src/imu/imu_ekf.c"
  $47 = $4; //@line 68 "../../src/imu/imu_ekf.c"
  $48 = (($46) + ($47<<3)|0); //@line 68 "../../src/imu/imu_ekf.c"
  HEAPF64[$48>>3] = 1.0; //@line 68 "../../src/imu/imu_ekf.c"
  $49 = $4; //@line 67 "../../src/imu/imu_ekf.c"
  $50 = (($49) + 1)|0; //@line 67 "../../src/imu/imu_ekf.c"
  $4 = $50; //@line 67 "../../src/imu/imu_ekf.c"
 }
 $51 = $3; //@line 72 "../../src/imu/imu_ekf.c"
 $52 = (_ekf_step($43,$51)|0); //@line 72 "../../src/imu/imu_ekf.c"
 STACKTOP = sp;return ($52|0); //@line 72 "../../src/imu/imu_ekf.c"
}
function _ekf_init($0,$1,$2) {
 $0 = $0|0;
 $1 = $1|0;
 $2 = $2|0;
 var $10 = 0, $11 = 0, $12 = 0, $13 = 0, $14 = 0, $15 = 0, $16 = 0, $17 = 0, $18 = 0, $19 = 0, $20 = 0, $21 = 0, $22 = 0, $23 = 0, $24 = 0, $25 = 0, $26 = 0, $27 = 0, $28 = 0, $29 = 0;
 var $3 = 0, $30 = 0, $31 = 0, $32 = 0, $33 = 0, $34 = 0, $35 = 0, $36 = 0, $37 = 0, $38 = 0, $39 = 0, $4 = 0, $40 = 0, $41 = 0, $5 = 0, $6 = 0, $7 = 0, $8 = 0, $9 = 0, label = 0;
 var sp = 0;
 sp = STACKTOP;
 STACKTOP = STACKTOP + 96|0; if ((STACKTOP|0) >= (STACK_MAX|0)) abortStackOverflow(96|0);
 $7 = sp;
 $3 = $0;
 $4 = $1;
 $5 = $2;
 $8 = $3; //@line 274 "../../src/tiny_ekf/tiny_ekf.c"
 $6 = $8; //@line 274 "../../src/tiny_ekf/tiny_ekf.c"
 $9 = $4; //@line 275 "../../src/tiny_ekf/tiny_ekf.c"
 $10 = $6; //@line 275 "../../src/tiny_ekf/tiny_ekf.c"
 HEAP32[$10>>2] = $9; //@line 275 "../../src/tiny_ekf/tiny_ekf.c"
 $11 = $6; //@line 276 "../../src/tiny_ekf/tiny_ekf.c"
 $12 = ((($11)) + 4|0); //@line 276 "../../src/tiny_ekf/tiny_ekf.c"
 $6 = $12; //@line 276 "../../src/tiny_ekf/tiny_ekf.c"
 $13 = $5; //@line 277 "../../src/tiny_ekf/tiny_ekf.c"
 $14 = $6; //@line 277 "../../src/tiny_ekf/tiny_ekf.c"
 HEAP32[$14>>2] = $13; //@line 277 "../../src/tiny_ekf/tiny_ekf.c"
 $15 = $3; //@line 281 "../../src/tiny_ekf/tiny_ekf.c"
 $16 = $4; //@line 281 "../../src/tiny_ekf/tiny_ekf.c"
 $17 = $5; //@line 281 "../../src/tiny_ekf/tiny_ekf.c"
 _unpack($15,$7,$16,$17); //@line 281 "../../src/tiny_ekf/tiny_ekf.c"
 $18 = ((($7)) + 4|0); //@line 284 "../../src/tiny_ekf/tiny_ekf.c"
 $19 = HEAP32[$18>>2]|0; //@line 284 "../../src/tiny_ekf/tiny_ekf.c"
 $20 = $4; //@line 284 "../../src/tiny_ekf/tiny_ekf.c"
 $21 = $4; //@line 284 "../../src/tiny_ekf/tiny_ekf.c"
 _zeros($19,$20,$21); //@line 284 "../../src/tiny_ekf/tiny_ekf.c"
 $22 = ((($7)) + 8|0); //@line 285 "../../src/tiny_ekf/tiny_ekf.c"
 $23 = HEAP32[$22>>2]|0; //@line 285 "../../src/tiny_ekf/tiny_ekf.c"
 $24 = $4; //@line 285 "../../src/tiny_ekf/tiny_ekf.c"
 $25 = $4; //@line 285 "../../src/tiny_ekf/tiny_ekf.c"
 _zeros($23,$24,$25); //@line 285 "../../src/tiny_ekf/tiny_ekf.c"
 $26 = ((($7)) + 12|0); //@line 286 "../../src/tiny_ekf/tiny_ekf.c"
 $27 = HEAP32[$26>>2]|0; //@line 286 "../../src/tiny_ekf/tiny_ekf.c"
 $28 = $5; //@line 286 "../../src/tiny_ekf/tiny_ekf.c"
 $29 = $5; //@line 286 "../../src/tiny_ekf/tiny_ekf.c"
 _zeros($27,$28,$29); //@line 286 "../../src/tiny_ekf/tiny_ekf.c"
 $30 = ((($7)) + 16|0); //@line 287 "../../src/tiny_ekf/tiny_ekf.c"
 $31 = HEAP32[$30>>2]|0; //@line 287 "../../src/tiny_ekf/tiny_ekf.c"
 $32 = $4; //@line 287 "../../src/tiny_ekf/tiny_ekf.c"
 $33 = $5; //@line 287 "../../src/tiny_ekf/tiny_ekf.c"
 _zeros($31,$32,$33); //@line 287 "../../src/tiny_ekf/tiny_ekf.c"
 $34 = ((($7)) + 20|0); //@line 288 "../../src/tiny_ekf/tiny_ekf.c"
 $35 = HEAP32[$34>>2]|0; //@line 288 "../../src/tiny_ekf/tiny_ekf.c"
 $36 = $4; //@line 288 "../../src/tiny_ekf/tiny_ekf.c"
 $37 = $4; //@line 288 "../../src/tiny_ekf/tiny_ekf.c"
 _zeros($35,$36,$37); //@line 288 "../../src/tiny_ekf/tiny_ekf.c"
 $38 = ((($7)) + 24|0); //@line 289 "../../src/tiny_ekf/tiny_ekf.c"
 $39 = HEAP32[$38>>2]|0; //@line 289 "../../src/tiny_ekf/tiny_ekf.c"
 $40 = $5; //@line 289 "../../src/tiny_ekf/tiny_ekf.c"
 $41 = $4; //@line 289 "../../src/tiny_ekf/tiny_ekf.c"
 _zeros($39,$40,$41); //@line 289 "../../src/tiny_ekf/tiny_ekf.c"
 STACKTOP = sp;return; //@line 290 "../../src/tiny_ekf/tiny_ekf.c"
}
function _unpack($0,$1,$2,$3) {
 $0 = $0|0;
 $1 = $1|0;
 $2 = $2|0;
 $3 = $3|0;
 var $10 = 0, $100 = 0, $101 = 0, $102 = 0, $103 = 0, $104 = 0, $105 = 0, $106 = 0, $107 = 0, $108 = 0, $109 = 0, $11 = 0, $110 = 0, $111 = 0, $112 = 0, $113 = 0, $114 = 0, $115 = 0, $116 = 0, $117 = 0;
 var $118 = 0, $119 = 0, $12 = 0, $120 = 0, $121 = 0, $122 = 0, $123 = 0, $124 = 0, $125 = 0, $126 = 0, $127 = 0, $128 = 0, $129 = 0, $13 = 0, $130 = 0, $131 = 0, $132 = 0, $133 = 0, $134 = 0, $135 = 0;
 var $136 = 0, $137 = 0, $138 = 0, $139 = 0, $14 = 0, $140 = 0, $141 = 0, $142 = 0, $143 = 0, $144 = 0, $145 = 0, $15 = 0, $16 = 0, $17 = 0, $18 = 0, $19 = 0, $20 = 0, $21 = 0, $22 = 0, $23 = 0;
 var $24 = 0, $25 = 0, $26 = 0, $27 = 0, $28 = 0, $29 = 0, $30 = 0, $31 = 0, $32 = 0, $33 = 0, $34 = 0, $35 = 0, $36 = 0, $37 = 0, $38 = 0, $39 = 0, $4 = 0, $40 = 0, $41 = 0, $42 = 0;
 var $43 = 0, $44 = 0, $45 = 0, $46 = 0, $47 = 0, $48 = 0, $49 = 0, $5 = 0, $50 = 0, $51 = 0, $52 = 0, $53 = 0, $54 = 0, $55 = 0, $56 = 0, $57 = 0, $58 = 0, $59 = 0, $6 = 0, $60 = 0;
 var $61 = 0, $62 = 0, $63 = 0, $64 = 0, $65 = 0, $66 = 0, $67 = 0, $68 = 0, $69 = 0, $7 = 0, $70 = 0, $71 = 0, $72 = 0, $73 = 0, $74 = 0, $75 = 0, $76 = 0, $77 = 0, $78 = 0, $79 = 0;
 var $8 = 0, $80 = 0, $81 = 0, $82 = 0, $83 = 0, $84 = 0, $85 = 0, $86 = 0, $87 = 0, $88 = 0, $89 = 0, $9 = 0, $90 = 0, $91 = 0, $92 = 0, $93 = 0, $94 = 0, $95 = 0, $96 = 0, $97 = 0;
 var $98 = 0, $99 = 0, label = 0, sp = 0;
 sp = STACKTOP;
 STACKTOP = STACKTOP + 32|0; if ((STACKTOP|0) >= (STACK_MAX|0)) abortStackOverflow(32|0);
 $4 = $0;
 $5 = $1;
 $6 = $2;
 $7 = $3;
 $10 = $4; //@line 230 "../../src/tiny_ekf/tiny_ekf.c"
 $8 = $10; //@line 230 "../../src/tiny_ekf/tiny_ekf.c"
 $11 = $8; //@line 231 "../../src/tiny_ekf/tiny_ekf.c"
 $12 = ((($11)) + 8|0); //@line 231 "../../src/tiny_ekf/tiny_ekf.c"
 $8 = $12; //@line 231 "../../src/tiny_ekf/tiny_ekf.c"
 $13 = $8; //@line 233 "../../src/tiny_ekf/tiny_ekf.c"
 $9 = $13; //@line 233 "../../src/tiny_ekf/tiny_ekf.c"
 $14 = $9; //@line 234 "../../src/tiny_ekf/tiny_ekf.c"
 $15 = $5; //@line 234 "../../src/tiny_ekf/tiny_ekf.c"
 HEAP32[$15>>2] = $14; //@line 234 "../../src/tiny_ekf/tiny_ekf.c"
 $16 = $6; //@line 235 "../../src/tiny_ekf/tiny_ekf.c"
 $17 = $9; //@line 235 "../../src/tiny_ekf/tiny_ekf.c"
 $18 = (($17) + ($16<<3)|0); //@line 235 "../../src/tiny_ekf/tiny_ekf.c"
 $9 = $18; //@line 235 "../../src/tiny_ekf/tiny_ekf.c"
 $19 = $9; //@line 236 "../../src/tiny_ekf/tiny_ekf.c"
 $20 = $5; //@line 236 "../../src/tiny_ekf/tiny_ekf.c"
 $21 = ((($20)) + 4|0); //@line 236 "../../src/tiny_ekf/tiny_ekf.c"
 HEAP32[$21>>2] = $19; //@line 236 "../../src/tiny_ekf/tiny_ekf.c"
 $22 = $6; //@line 237 "../../src/tiny_ekf/tiny_ekf.c"
 $23 = $6; //@line 237 "../../src/tiny_ekf/tiny_ekf.c"
 $24 = Math_imul($22, $23)|0; //@line 237 "../../src/tiny_ekf/tiny_ekf.c"
 $25 = $9; //@line 237 "../../src/tiny_ekf/tiny_ekf.c"
 $26 = (($25) + ($24<<3)|0); //@line 237 "../../src/tiny_ekf/tiny_ekf.c"
 $9 = $26; //@line 237 "../../src/tiny_ekf/tiny_ekf.c"
 $27 = $9; //@line 238 "../../src/tiny_ekf/tiny_ekf.c"
 $28 = $5; //@line 238 "../../src/tiny_ekf/tiny_ekf.c"
 $29 = ((($28)) + 8|0); //@line 238 "../../src/tiny_ekf/tiny_ekf.c"
 HEAP32[$29>>2] = $27; //@line 238 "../../src/tiny_ekf/tiny_ekf.c"
 $30 = $6; //@line 239 "../../src/tiny_ekf/tiny_ekf.c"
 $31 = $6; //@line 239 "../../src/tiny_ekf/tiny_ekf.c"
 $32 = Math_imul($30, $31)|0; //@line 239 "../../src/tiny_ekf/tiny_ekf.c"
 $33 = $9; //@line 239 "../../src/tiny_ekf/tiny_ekf.c"
 $34 = (($33) + ($32<<3)|0); //@line 239 "../../src/tiny_ekf/tiny_ekf.c"
 $9 = $34; //@line 239 "../../src/tiny_ekf/tiny_ekf.c"
 $35 = $9; //@line 240 "../../src/tiny_ekf/tiny_ekf.c"
 $36 = $5; //@line 240 "../../src/tiny_ekf/tiny_ekf.c"
 $37 = ((($36)) + 12|0); //@line 240 "../../src/tiny_ekf/tiny_ekf.c"
 HEAP32[$37>>2] = $35; //@line 240 "../../src/tiny_ekf/tiny_ekf.c"
 $38 = $7; //@line 241 "../../src/tiny_ekf/tiny_ekf.c"
 $39 = $7; //@line 241 "../../src/tiny_ekf/tiny_ekf.c"
 $40 = Math_imul($38, $39)|0; //@line 241 "../../src/tiny_ekf/tiny_ekf.c"
 $41 = $9; //@line 241 "../../src/tiny_ekf/tiny_ekf.c"
 $42 = (($41) + ($40<<3)|0); //@line 241 "../../src/tiny_ekf/tiny_ekf.c"
 $9 = $42; //@line 241 "../../src/tiny_ekf/tiny_ekf.c"
 $43 = $9; //@line 242 "../../src/tiny_ekf/tiny_ekf.c"
 $44 = $5; //@line 242 "../../src/tiny_ekf/tiny_ekf.c"
 $45 = ((($44)) + 16|0); //@line 242 "../../src/tiny_ekf/tiny_ekf.c"
 HEAP32[$45>>2] = $43; //@line 242 "../../src/tiny_ekf/tiny_ekf.c"
 $46 = $6; //@line 243 "../../src/tiny_ekf/tiny_ekf.c"
 $47 = $7; //@line 243 "../../src/tiny_ekf/tiny_ekf.c"
 $48 = Math_imul($46, $47)|0; //@line 243 "../../src/tiny_ekf/tiny_ekf.c"
 $49 = $9; //@line 243 "../../src/tiny_ekf/tiny_ekf.c"
 $50 = (($49) + ($48<<3)|0); //@line 243 "../../src/tiny_ekf/tiny_ekf.c"
 $9 = $50; //@line 243 "../../src/tiny_ekf/tiny_ekf.c"
 $51 = $9; //@line 244 "../../src/tiny_ekf/tiny_ekf.c"
 $52 = $5; //@line 244 "../../src/tiny_ekf/tiny_ekf.c"
 $53 = ((($52)) + 20|0); //@line 244 "../../src/tiny_ekf/tiny_ekf.c"
 HEAP32[$53>>2] = $51; //@line 244 "../../src/tiny_ekf/tiny_ekf.c"
 $54 = $6; //@line 245 "../../src/tiny_ekf/tiny_ekf.c"
 $55 = $6; //@line 245 "../../src/tiny_ekf/tiny_ekf.c"
 $56 = Math_imul($54, $55)|0; //@line 245 "../../src/tiny_ekf/tiny_ekf.c"
 $57 = $9; //@line 245 "../../src/tiny_ekf/tiny_ekf.c"
 $58 = (($57) + ($56<<3)|0); //@line 245 "../../src/tiny_ekf/tiny_ekf.c"
 $9 = $58; //@line 245 "../../src/tiny_ekf/tiny_ekf.c"
 $59 = $9; //@line 246 "../../src/tiny_ekf/tiny_ekf.c"
 $60 = $5; //@line 246 "../../src/tiny_ekf/tiny_ekf.c"
 $61 = ((($60)) + 24|0); //@line 246 "../../src/tiny_ekf/tiny_ekf.c"
 HEAP32[$61>>2] = $59; //@line 246 "../../src/tiny_ekf/tiny_ekf.c"
 $62 = $7; //@line 247 "../../src/tiny_ekf/tiny_ekf.c"
 $63 = $6; //@line 247 "../../src/tiny_ekf/tiny_ekf.c"
 $64 = Math_imul($62, $63)|0; //@line 247 "../../src/tiny_ekf/tiny_ekf.c"
 $65 = $9; //@line 247 "../../src/tiny_ekf/tiny_ekf.c"
 $66 = (($65) + ($64<<3)|0); //@line 247 "../../src/tiny_ekf/tiny_ekf.c"
 $9 = $66; //@line 247 "../../src/tiny_ekf/tiny_ekf.c"
 $67 = $9; //@line 248 "../../src/tiny_ekf/tiny_ekf.c"
 $68 = $5; //@line 248 "../../src/tiny_ekf/tiny_ekf.c"
 $69 = ((($68)) + 28|0); //@line 248 "../../src/tiny_ekf/tiny_ekf.c"
 HEAP32[$69>>2] = $67; //@line 248 "../../src/tiny_ekf/tiny_ekf.c"
 $70 = $6; //@line 249 "../../src/tiny_ekf/tiny_ekf.c"
 $71 = $7; //@line 249 "../../src/tiny_ekf/tiny_ekf.c"
 $72 = Math_imul($70, $71)|0; //@line 249 "../../src/tiny_ekf/tiny_ekf.c"
 $73 = $9; //@line 249 "../../src/tiny_ekf/tiny_ekf.c"
 $74 = (($73) + ($72<<3)|0); //@line 249 "../../src/tiny_ekf/tiny_ekf.c"
 $9 = $74; //@line 249 "../../src/tiny_ekf/tiny_ekf.c"
 $75 = $9; //@line 250 "../../src/tiny_ekf/tiny_ekf.c"
 $76 = $5; //@line 250 "../../src/tiny_ekf/tiny_ekf.c"
 $77 = ((($76)) + 32|0); //@line 250 "../../src/tiny_ekf/tiny_ekf.c"
 HEAP32[$77>>2] = $75; //@line 250 "../../src/tiny_ekf/tiny_ekf.c"
 $78 = $6; //@line 251 "../../src/tiny_ekf/tiny_ekf.c"
 $79 = $6; //@line 251 "../../src/tiny_ekf/tiny_ekf.c"
 $80 = Math_imul($78, $79)|0; //@line 251 "../../src/tiny_ekf/tiny_ekf.c"
 $81 = $9; //@line 251 "../../src/tiny_ekf/tiny_ekf.c"
 $82 = (($81) + ($80<<3)|0); //@line 251 "../../src/tiny_ekf/tiny_ekf.c"
 $9 = $82; //@line 251 "../../src/tiny_ekf/tiny_ekf.c"
 $83 = $9; //@line 252 "../../src/tiny_ekf/tiny_ekf.c"
 $84 = $5; //@line 252 "../../src/tiny_ekf/tiny_ekf.c"
 $85 = ((($84)) + 36|0); //@line 252 "../../src/tiny_ekf/tiny_ekf.c"
 HEAP32[$85>>2] = $83; //@line 252 "../../src/tiny_ekf/tiny_ekf.c"
 $86 = $6; //@line 253 "../../src/tiny_ekf/tiny_ekf.c"
 $87 = $6; //@line 253 "../../src/tiny_ekf/tiny_ekf.c"
 $88 = Math_imul($86, $87)|0; //@line 253 "../../src/tiny_ekf/tiny_ekf.c"
 $89 = $9; //@line 253 "../../src/tiny_ekf/tiny_ekf.c"
 $90 = (($89) + ($88<<3)|0); //@line 253 "../../src/tiny_ekf/tiny_ekf.c"
 $9 = $90; //@line 253 "../../src/tiny_ekf/tiny_ekf.c"
 $91 = $9; //@line 254 "../../src/tiny_ekf/tiny_ekf.c"
 $92 = $5; //@line 254 "../../src/tiny_ekf/tiny_ekf.c"
 $93 = ((($92)) + 40|0); //@line 254 "../../src/tiny_ekf/tiny_ekf.c"
 HEAP32[$93>>2] = $91; //@line 254 "../../src/tiny_ekf/tiny_ekf.c"
 $94 = $6; //@line 255 "../../src/tiny_ekf/tiny_ekf.c"
 $95 = $9; //@line 255 "../../src/tiny_ekf/tiny_ekf.c"
 $96 = (($95) + ($94<<3)|0); //@line 255 "../../src/tiny_ekf/tiny_ekf.c"
 $9 = $96; //@line 255 "../../src/tiny_ekf/tiny_ekf.c"
 $97 = $9; //@line 256 "../../src/tiny_ekf/tiny_ekf.c"
 $98 = $5; //@line 256 "../../src/tiny_ekf/tiny_ekf.c"
 $99 = ((($98)) + 44|0); //@line 256 "../../src/tiny_ekf/tiny_ekf.c"
 HEAP32[$99>>2] = $97; //@line 256 "../../src/tiny_ekf/tiny_ekf.c"
 $100 = $7; //@line 257 "../../src/tiny_ekf/tiny_ekf.c"
 $101 = $9; //@line 257 "../../src/tiny_ekf/tiny_ekf.c"
 $102 = (($101) + ($100<<3)|0); //@line 257 "../../src/tiny_ekf/tiny_ekf.c"
 $9 = $102; //@line 257 "../../src/tiny_ekf/tiny_ekf.c"
 $103 = $9; //@line 258 "../../src/tiny_ekf/tiny_ekf.c"
 $104 = $5; //@line 258 "../../src/tiny_ekf/tiny_ekf.c"
 $105 = ((($104)) + 48|0); //@line 258 "../../src/tiny_ekf/tiny_ekf.c"
 HEAP32[$105>>2] = $103; //@line 258 "../../src/tiny_ekf/tiny_ekf.c"
 $106 = $6; //@line 259 "../../src/tiny_ekf/tiny_ekf.c"
 $107 = $6; //@line 259 "../../src/tiny_ekf/tiny_ekf.c"
 $108 = Math_imul($106, $107)|0; //@line 259 "../../src/tiny_ekf/tiny_ekf.c"
 $109 = $9; //@line 259 "../../src/tiny_ekf/tiny_ekf.c"
 $110 = (($109) + ($108<<3)|0); //@line 259 "../../src/tiny_ekf/tiny_ekf.c"
 $9 = $110; //@line 259 "../../src/tiny_ekf/tiny_ekf.c"
 $111 = $9; //@line 260 "../../src/tiny_ekf/tiny_ekf.c"
 $112 = $5; //@line 260 "../../src/tiny_ekf/tiny_ekf.c"
 $113 = ((($112)) + 52|0); //@line 260 "../../src/tiny_ekf/tiny_ekf.c"
 HEAP32[$113>>2] = $111; //@line 260 "../../src/tiny_ekf/tiny_ekf.c"
 $114 = $6; //@line 261 "../../src/tiny_ekf/tiny_ekf.c"
 $115 = $7; //@line 261 "../../src/tiny_ekf/tiny_ekf.c"
 $116 = Math_imul($114, $115)|0; //@line 261 "../../src/tiny_ekf/tiny_ekf.c"
 $117 = $9; //@line 261 "../../src/tiny_ekf/tiny_ekf.c"
 $118 = (($117) + ($116<<3)|0); //@line 261 "../../src/tiny_ekf/tiny_ekf.c"
 $9 = $118; //@line 261 "../../src/tiny_ekf/tiny_ekf.c"
 $119 = $9; //@line 262 "../../src/tiny_ekf/tiny_ekf.c"
 $120 = $5; //@line 262 "../../src/tiny_ekf/tiny_ekf.c"
 $121 = ((($120)) + 56|0); //@line 262 "../../src/tiny_ekf/tiny_ekf.c"
 HEAP32[$121>>2] = $119; //@line 262 "../../src/tiny_ekf/tiny_ekf.c"
 $122 = $7; //@line 263 "../../src/tiny_ekf/tiny_ekf.c"
 $123 = $6; //@line 263 "../../src/tiny_ekf/tiny_ekf.c"
 $124 = Math_imul($122, $123)|0; //@line 263 "../../src/tiny_ekf/tiny_ekf.c"
 $125 = $9; //@line 263 "../../src/tiny_ekf/tiny_ekf.c"
 $126 = (($125) + ($124<<3)|0); //@line 263 "../../src/tiny_ekf/tiny_ekf.c"
 $9 = $126; //@line 263 "../../src/tiny_ekf/tiny_ekf.c"
 $127 = $9; //@line 264 "../../src/tiny_ekf/tiny_ekf.c"
 $128 = $5; //@line 264 "../../src/tiny_ekf/tiny_ekf.c"
 $129 = ((($128)) + 60|0); //@line 264 "../../src/tiny_ekf/tiny_ekf.c"
 HEAP32[$129>>2] = $127; //@line 264 "../../src/tiny_ekf/tiny_ekf.c"
 $130 = $7; //@line 265 "../../src/tiny_ekf/tiny_ekf.c"
 $131 = $7; //@line 265 "../../src/tiny_ekf/tiny_ekf.c"
 $132 = Math_imul($130, $131)|0; //@line 265 "../../src/tiny_ekf/tiny_ekf.c"
 $133 = $9; //@line 265 "../../src/tiny_ekf/tiny_ekf.c"
 $134 = (($133) + ($132<<3)|0); //@line 265 "../../src/tiny_ekf/tiny_ekf.c"
 $9 = $134; //@line 265 "../../src/tiny_ekf/tiny_ekf.c"
 $135 = $9; //@line 266 "../../src/tiny_ekf/tiny_ekf.c"
 $136 = $5; //@line 266 "../../src/tiny_ekf/tiny_ekf.c"
 $137 = ((($136)) + 64|0); //@line 266 "../../src/tiny_ekf/tiny_ekf.c"
 HEAP32[$137>>2] = $135; //@line 266 "../../src/tiny_ekf/tiny_ekf.c"
 $138 = $7; //@line 267 "../../src/tiny_ekf/tiny_ekf.c"
 $139 = $7; //@line 267 "../../src/tiny_ekf/tiny_ekf.c"
 $140 = Math_imul($138, $139)|0; //@line 267 "../../src/tiny_ekf/tiny_ekf.c"
 $141 = $9; //@line 267 "../../src/tiny_ekf/tiny_ekf.c"
 $142 = (($141) + ($140<<3)|0); //@line 267 "../../src/tiny_ekf/tiny_ekf.c"
 $9 = $142; //@line 267 "../../src/tiny_ekf/tiny_ekf.c"
 $143 = $9; //@line 268 "../../src/tiny_ekf/tiny_ekf.c"
 $144 = $5; //@line 268 "../../src/tiny_ekf/tiny_ekf.c"
 $145 = ((($144)) + 68|0); //@line 268 "../../src/tiny_ekf/tiny_ekf.c"
 HEAP32[$145>>2] = $143; //@line 268 "../../src/tiny_ekf/tiny_ekf.c"
 STACKTOP = sp;return; //@line 269 "../../src/tiny_ekf/tiny_ekf.c"
}
function _zeros($0,$1,$2) {
 $0 = $0|0;
 $1 = $1|0;
 $2 = $2|0;
 var $10 = 0, $11 = 0, $12 = 0, $13 = 0, $14 = 0, $15 = 0, $16 = 0, $3 = 0, $4 = 0, $5 = 0, $6 = 0, $7 = 0, $8 = 0, $9 = 0, label = 0, sp = 0;
 sp = STACKTOP;
 STACKTOP = STACKTOP + 16|0; if ((STACKTOP|0) >= (STACK_MAX|0)) abortStackOverflow(16|0);
 $3 = $0;
 $4 = $1;
 $5 = $2;
 $6 = 0; //@line 95 "../../src/tiny_ekf/tiny_ekf.c"
 while(1) {
  $7 = $6; //@line 95 "../../src/tiny_ekf/tiny_ekf.c"
  $8 = $4; //@line 95 "../../src/tiny_ekf/tiny_ekf.c"
  $9 = $5; //@line 95 "../../src/tiny_ekf/tiny_ekf.c"
  $10 = Math_imul($8, $9)|0; //@line 95 "../../src/tiny_ekf/tiny_ekf.c"
  $11 = ($7|0)<($10|0); //@line 95 "../../src/tiny_ekf/tiny_ekf.c"
  if (!($11)) {
   break;
  }
  $12 = $3; //@line 96 "../../src/tiny_ekf/tiny_ekf.c"
  $13 = $6; //@line 96 "../../src/tiny_ekf/tiny_ekf.c"
  $14 = (($12) + ($13<<3)|0); //@line 96 "../../src/tiny_ekf/tiny_ekf.c"
  HEAPF64[$14>>3] = 0.0; //@line 96 "../../src/tiny_ekf/tiny_ekf.c"
  $15 = $6; //@line 95 "../../src/tiny_ekf/tiny_ekf.c"
  $16 = (($15) + 1)|0; //@line 95 "../../src/tiny_ekf/tiny_ekf.c"
  $6 = $16; //@line 95 "../../src/tiny_ekf/tiny_ekf.c"
 }
 STACKTOP = sp;return; //@line 97 "../../src/tiny_ekf/tiny_ekf.c"
}
function _ekf_step($0,$1) {
 $0 = $0|0;
 $1 = $1|0;
 var $10 = 0, $100 = 0, $101 = 0, $102 = 0, $103 = 0, $104 = 0, $105 = 0, $106 = 0, $107 = 0, $108 = 0, $109 = 0, $11 = 0, $110 = 0, $111 = 0, $112 = 0, $113 = 0, $114 = 0, $115 = 0, $116 = 0, $117 = 0;
 var $118 = 0, $119 = 0, $12 = 0, $120 = 0, $121 = 0, $122 = 0, $123 = 0, $124 = 0, $125 = 0, $126 = 0, $127 = 0, $128 = 0, $129 = 0, $13 = 0, $130 = 0, $131 = 0, $132 = 0, $133 = 0, $134 = 0, $135 = 0;
 var $136 = 0, $137 = 0, $138 = 0, $139 = 0, $14 = 0, $140 = 0, $141 = 0, $142 = 0, $143 = 0, $144 = 0, $145 = 0, $146 = 0, $147 = 0, $148 = 0, $149 = 0, $15 = 0, $150 = 0, $151 = 0, $16 = 0, $17 = 0;
 var $18 = 0, $19 = 0, $2 = 0, $20 = 0, $21 = 0, $22 = 0, $23 = 0, $24 = 0, $25 = 0, $26 = 0, $27 = 0, $28 = 0, $29 = 0, $3 = 0, $30 = 0, $31 = 0, $32 = 0, $33 = 0, $34 = 0, $35 = 0;
 var $36 = 0, $37 = 0, $38 = 0, $39 = 0, $4 = 0, $40 = 0, $41 = 0, $42 = 0, $43 = 0, $44 = 0, $45 = 0, $46 = 0, $47 = 0, $48 = 0, $49 = 0, $5 = 0, $50 = 0, $51 = 0, $52 = 0, $53 = 0;
 var $54 = 0, $55 = 0, $56 = 0, $57 = 0, $58 = 0, $59 = 0, $6 = 0, $60 = 0, $61 = 0, $62 = 0, $63 = 0, $64 = 0, $65 = 0, $66 = 0, $67 = 0, $68 = 0, $69 = 0, $7 = 0, $70 = 0, $71 = 0;
 var $72 = 0, $73 = 0, $74 = 0, $75 = 0, $76 = 0, $77 = 0, $78 = 0, $79 = 0, $8 = 0, $80 = 0, $81 = 0, $82 = 0, $83 = 0, $84 = 0, $85 = 0, $86 = 0, $87 = 0, $88 = 0, $89 = 0, $9 = 0;
 var $90 = 0, $91 = 0, $92 = 0, $93 = 0, $94 = 0, $95 = 0, $96 = 0, $97 = 0, $98 = 0, $99 = 0, label = 0, sp = 0;
 sp = STACKTOP;
 STACKTOP = STACKTOP + 96|0; if ((STACKTOP|0) >= (STACK_MAX|0)) abortStackOverflow(96|0);
 $8 = sp;
 $3 = $0;
 $4 = $1;
 $9 = $3; //@line 296 "../../src/tiny_ekf/tiny_ekf.c"
 $5 = $9; //@line 296 "../../src/tiny_ekf/tiny_ekf.c"
 $10 = $5; //@line 297 "../../src/tiny_ekf/tiny_ekf.c"
 $11 = HEAP32[$10>>2]|0; //@line 297 "../../src/tiny_ekf/tiny_ekf.c"
 $6 = $11; //@line 297 "../../src/tiny_ekf/tiny_ekf.c"
 $12 = $5; //@line 298 "../../src/tiny_ekf/tiny_ekf.c"
 $13 = ((($12)) + 4|0); //@line 298 "../../src/tiny_ekf/tiny_ekf.c"
 $5 = $13; //@line 298 "../../src/tiny_ekf/tiny_ekf.c"
 $14 = $5; //@line 299 "../../src/tiny_ekf/tiny_ekf.c"
 $15 = HEAP32[$14>>2]|0; //@line 299 "../../src/tiny_ekf/tiny_ekf.c"
 $7 = $15; //@line 299 "../../src/tiny_ekf/tiny_ekf.c"
 $16 = $3; //@line 302 "../../src/tiny_ekf/tiny_ekf.c"
 $17 = $6; //@line 302 "../../src/tiny_ekf/tiny_ekf.c"
 $18 = $7; //@line 302 "../../src/tiny_ekf/tiny_ekf.c"
 _unpack($16,$8,$17,$18); //@line 302 "../../src/tiny_ekf/tiny_ekf.c"
 $19 = ((($8)) + 20|0); //@line 305 "../../src/tiny_ekf/tiny_ekf.c"
 $20 = HEAP32[$19>>2]|0; //@line 305 "../../src/tiny_ekf/tiny_ekf.c"
 $21 = ((($8)) + 4|0); //@line 305 "../../src/tiny_ekf/tiny_ekf.c"
 $22 = HEAP32[$21>>2]|0; //@line 305 "../../src/tiny_ekf/tiny_ekf.c"
 $23 = ((($8)) + 48|0); //@line 305 "../../src/tiny_ekf/tiny_ekf.c"
 $24 = HEAP32[$23>>2]|0; //@line 305 "../../src/tiny_ekf/tiny_ekf.c"
 $25 = $6; //@line 305 "../../src/tiny_ekf/tiny_ekf.c"
 $26 = $6; //@line 305 "../../src/tiny_ekf/tiny_ekf.c"
 $27 = $6; //@line 305 "../../src/tiny_ekf/tiny_ekf.c"
 _mulmat($20,$22,$24,$25,$26,$27); //@line 305 "../../src/tiny_ekf/tiny_ekf.c"
 $28 = ((($8)) + 20|0); //@line 306 "../../src/tiny_ekf/tiny_ekf.c"
 $29 = HEAP32[$28>>2]|0; //@line 306 "../../src/tiny_ekf/tiny_ekf.c"
 $30 = ((($8)) + 32|0); //@line 306 "../../src/tiny_ekf/tiny_ekf.c"
 $31 = HEAP32[$30>>2]|0; //@line 306 "../../src/tiny_ekf/tiny_ekf.c"
 $32 = $6; //@line 306 "../../src/tiny_ekf/tiny_ekf.c"
 $33 = $6; //@line 306 "../../src/tiny_ekf/tiny_ekf.c"
 _transpose($29,$31,$32,$33); //@line 306 "../../src/tiny_ekf/tiny_ekf.c"
 $34 = ((($8)) + 48|0); //@line 307 "../../src/tiny_ekf/tiny_ekf.c"
 $35 = HEAP32[$34>>2]|0; //@line 307 "../../src/tiny_ekf/tiny_ekf.c"
 $36 = ((($8)) + 32|0); //@line 307 "../../src/tiny_ekf/tiny_ekf.c"
 $37 = HEAP32[$36>>2]|0; //@line 307 "../../src/tiny_ekf/tiny_ekf.c"
 $38 = ((($8)) + 36|0); //@line 307 "../../src/tiny_ekf/tiny_ekf.c"
 $39 = HEAP32[$38>>2]|0; //@line 307 "../../src/tiny_ekf/tiny_ekf.c"
 $40 = $6; //@line 307 "../../src/tiny_ekf/tiny_ekf.c"
 $41 = $6; //@line 307 "../../src/tiny_ekf/tiny_ekf.c"
 $42 = $6; //@line 307 "../../src/tiny_ekf/tiny_ekf.c"
 _mulmat($35,$37,$39,$40,$41,$42); //@line 307 "../../src/tiny_ekf/tiny_ekf.c"
 $43 = ((($8)) + 36|0); //@line 308 "../../src/tiny_ekf/tiny_ekf.c"
 $44 = HEAP32[$43>>2]|0; //@line 308 "../../src/tiny_ekf/tiny_ekf.c"
 $45 = ((($8)) + 8|0); //@line 308 "../../src/tiny_ekf/tiny_ekf.c"
 $46 = HEAP32[$45>>2]|0; //@line 308 "../../src/tiny_ekf/tiny_ekf.c"
 $47 = $6; //@line 308 "../../src/tiny_ekf/tiny_ekf.c"
 $48 = $6; //@line 308 "../../src/tiny_ekf/tiny_ekf.c"
 _accum($44,$46,$47,$48); //@line 308 "../../src/tiny_ekf/tiny_ekf.c"
 $49 = ((($8)) + 24|0); //@line 311 "../../src/tiny_ekf/tiny_ekf.c"
 $50 = HEAP32[$49>>2]|0; //@line 311 "../../src/tiny_ekf/tiny_ekf.c"
 $51 = ((($8)) + 28|0); //@line 311 "../../src/tiny_ekf/tiny_ekf.c"
 $52 = HEAP32[$51>>2]|0; //@line 311 "../../src/tiny_ekf/tiny_ekf.c"
 $53 = $7; //@line 311 "../../src/tiny_ekf/tiny_ekf.c"
 $54 = $6; //@line 311 "../../src/tiny_ekf/tiny_ekf.c"
 _transpose($50,$52,$53,$54); //@line 311 "../../src/tiny_ekf/tiny_ekf.c"
 $55 = ((($8)) + 36|0); //@line 312 "../../src/tiny_ekf/tiny_ekf.c"
 $56 = HEAP32[$55>>2]|0; //@line 312 "../../src/tiny_ekf/tiny_ekf.c"
 $57 = ((($8)) + 28|0); //@line 312 "../../src/tiny_ekf/tiny_ekf.c"
 $58 = HEAP32[$57>>2]|0; //@line 312 "../../src/tiny_ekf/tiny_ekf.c"
 $59 = ((($8)) + 52|0); //@line 312 "../../src/tiny_ekf/tiny_ekf.c"
 $60 = HEAP32[$59>>2]|0; //@line 312 "../../src/tiny_ekf/tiny_ekf.c"
 $61 = $6; //@line 312 "../../src/tiny_ekf/tiny_ekf.c"
 $62 = $6; //@line 312 "../../src/tiny_ekf/tiny_ekf.c"
 $63 = $7; //@line 312 "../../src/tiny_ekf/tiny_ekf.c"
 _mulmat($56,$58,$60,$61,$62,$63); //@line 312 "../../src/tiny_ekf/tiny_ekf.c"
 $64 = ((($8)) + 24|0); //@line 313 "../../src/tiny_ekf/tiny_ekf.c"
 $65 = HEAP32[$64>>2]|0; //@line 313 "../../src/tiny_ekf/tiny_ekf.c"
 $66 = ((($8)) + 36|0); //@line 313 "../../src/tiny_ekf/tiny_ekf.c"
 $67 = HEAP32[$66>>2]|0; //@line 313 "../../src/tiny_ekf/tiny_ekf.c"
 $68 = ((($8)) + 56|0); //@line 313 "../../src/tiny_ekf/tiny_ekf.c"
 $69 = HEAP32[$68>>2]|0; //@line 313 "../../src/tiny_ekf/tiny_ekf.c"
 $70 = $7; //@line 313 "../../src/tiny_ekf/tiny_ekf.c"
 $71 = $6; //@line 313 "../../src/tiny_ekf/tiny_ekf.c"
 $72 = $6; //@line 313 "../../src/tiny_ekf/tiny_ekf.c"
 _mulmat($65,$67,$69,$70,$71,$72); //@line 313 "../../src/tiny_ekf/tiny_ekf.c"
 $73 = ((($8)) + 56|0); //@line 314 "../../src/tiny_ekf/tiny_ekf.c"
 $74 = HEAP32[$73>>2]|0; //@line 314 "../../src/tiny_ekf/tiny_ekf.c"
 $75 = ((($8)) + 28|0); //@line 314 "../../src/tiny_ekf/tiny_ekf.c"
 $76 = HEAP32[$75>>2]|0; //@line 314 "../../src/tiny_ekf/tiny_ekf.c"
 $77 = ((($8)) + 60|0); //@line 314 "../../src/tiny_ekf/tiny_ekf.c"
 $78 = HEAP32[$77>>2]|0; //@line 314 "../../src/tiny_ekf/tiny_ekf.c"
 $79 = $7; //@line 314 "../../src/tiny_ekf/tiny_ekf.c"
 $80 = $6; //@line 314 "../../src/tiny_ekf/tiny_ekf.c"
 $81 = $7; //@line 314 "../../src/tiny_ekf/tiny_ekf.c"
 _mulmat($74,$76,$78,$79,$80,$81); //@line 314 "../../src/tiny_ekf/tiny_ekf.c"
 $82 = ((($8)) + 60|0); //@line 315 "../../src/tiny_ekf/tiny_ekf.c"
 $83 = HEAP32[$82>>2]|0; //@line 315 "../../src/tiny_ekf/tiny_ekf.c"
 $84 = ((($8)) + 12|0); //@line 315 "../../src/tiny_ekf/tiny_ekf.c"
 $85 = HEAP32[$84>>2]|0; //@line 315 "../../src/tiny_ekf/tiny_ekf.c"
 $86 = $7; //@line 315 "../../src/tiny_ekf/tiny_ekf.c"
 $87 = $7; //@line 315 "../../src/tiny_ekf/tiny_ekf.c"
 _accum($83,$85,$86,$87); //@line 315 "../../src/tiny_ekf/tiny_ekf.c"
 $88 = ((($8)) + 60|0); //@line 316 "../../src/tiny_ekf/tiny_ekf.c"
 $89 = HEAP32[$88>>2]|0; //@line 316 "../../src/tiny_ekf/tiny_ekf.c"
 $90 = ((($8)) + 64|0); //@line 316 "../../src/tiny_ekf/tiny_ekf.c"
 $91 = HEAP32[$90>>2]|0; //@line 316 "../../src/tiny_ekf/tiny_ekf.c"
 $92 = ((($8)) + 68|0); //@line 316 "../../src/tiny_ekf/tiny_ekf.c"
 $93 = HEAP32[$92>>2]|0; //@line 316 "../../src/tiny_ekf/tiny_ekf.c"
 $94 = $7; //@line 316 "../../src/tiny_ekf/tiny_ekf.c"
 $95 = (_cholsl($89,$91,$93,$94)|0); //@line 316 "../../src/tiny_ekf/tiny_ekf.c"
 $96 = ($95|0)!=(0); //@line 316 "../../src/tiny_ekf/tiny_ekf.c"
 if ($96) {
  $2 = 1; //@line 316 "../../src/tiny_ekf/tiny_ekf.c"
  $151 = $2; //@line 332 "../../src/tiny_ekf/tiny_ekf.c"
  STACKTOP = sp;return ($151|0); //@line 332 "../../src/tiny_ekf/tiny_ekf.c"
 } else {
  $97 = ((($8)) + 52|0); //@line 317 "../../src/tiny_ekf/tiny_ekf.c"
  $98 = HEAP32[$97>>2]|0; //@line 317 "../../src/tiny_ekf/tiny_ekf.c"
  $99 = ((($8)) + 64|0); //@line 317 "../../src/tiny_ekf/tiny_ekf.c"
  $100 = HEAP32[$99>>2]|0; //@line 317 "../../src/tiny_ekf/tiny_ekf.c"
  $101 = ((($8)) + 16|0); //@line 317 "../../src/tiny_ekf/tiny_ekf.c"
  $102 = HEAP32[$101>>2]|0; //@line 317 "../../src/tiny_ekf/tiny_ekf.c"
  $103 = $6; //@line 317 "../../src/tiny_ekf/tiny_ekf.c"
  $104 = $7; //@line 317 "../../src/tiny_ekf/tiny_ekf.c"
  $105 = $7; //@line 317 "../../src/tiny_ekf/tiny_ekf.c"
  _mulmat($98,$100,$102,$103,$104,$105); //@line 317 "../../src/tiny_ekf/tiny_ekf.c"
  $106 = $4; //@line 320 "../../src/tiny_ekf/tiny_ekf.c"
  $107 = ((($8)) + 44|0); //@line 320 "../../src/tiny_ekf/tiny_ekf.c"
  $108 = HEAP32[$107>>2]|0; //@line 320 "../../src/tiny_ekf/tiny_ekf.c"
  $109 = ((($8)) + 68|0); //@line 320 "../../src/tiny_ekf/tiny_ekf.c"
  $110 = HEAP32[$109>>2]|0; //@line 320 "../../src/tiny_ekf/tiny_ekf.c"
  $111 = $7; //@line 320 "../../src/tiny_ekf/tiny_ekf.c"
  _sub($106,$108,$110,$111); //@line 320 "../../src/tiny_ekf/tiny_ekf.c"
  $112 = ((($8)) + 16|0); //@line 321 "../../src/tiny_ekf/tiny_ekf.c"
  $113 = HEAP32[$112>>2]|0; //@line 321 "../../src/tiny_ekf/tiny_ekf.c"
  $114 = ((($8)) + 68|0); //@line 321 "../../src/tiny_ekf/tiny_ekf.c"
  $115 = HEAP32[$114>>2]|0; //@line 321 "../../src/tiny_ekf/tiny_ekf.c"
  $116 = ((($8)) + 56|0); //@line 321 "../../src/tiny_ekf/tiny_ekf.c"
  $117 = HEAP32[$116>>2]|0; //@line 321 "../../src/tiny_ekf/tiny_ekf.c"
  $118 = $6; //@line 321 "../../src/tiny_ekf/tiny_ekf.c"
  $119 = $7; //@line 321 "../../src/tiny_ekf/tiny_ekf.c"
  _mulvec($113,$115,$117,$118,$119); //@line 321 "../../src/tiny_ekf/tiny_ekf.c"
  $120 = ((($8)) + 40|0); //@line 322 "../../src/tiny_ekf/tiny_ekf.c"
  $121 = HEAP32[$120>>2]|0; //@line 322 "../../src/tiny_ekf/tiny_ekf.c"
  $122 = ((($8)) + 56|0); //@line 322 "../../src/tiny_ekf/tiny_ekf.c"
  $123 = HEAP32[$122>>2]|0; //@line 322 "../../src/tiny_ekf/tiny_ekf.c"
  $124 = HEAP32[$8>>2]|0; //@line 322 "../../src/tiny_ekf/tiny_ekf.c"
  $125 = $6; //@line 322 "../../src/tiny_ekf/tiny_ekf.c"
  _add($121,$123,$124,$125); //@line 322 "../../src/tiny_ekf/tiny_ekf.c"
  $126 = ((($8)) + 16|0); //@line 325 "../../src/tiny_ekf/tiny_ekf.c"
  $127 = HEAP32[$126>>2]|0; //@line 325 "../../src/tiny_ekf/tiny_ekf.c"
  $128 = ((($8)) + 24|0); //@line 325 "../../src/tiny_ekf/tiny_ekf.c"
  $129 = HEAP32[$128>>2]|0; //@line 325 "../../src/tiny_ekf/tiny_ekf.c"
  $130 = ((($8)) + 48|0); //@line 325 "../../src/tiny_ekf/tiny_ekf.c"
  $131 = HEAP32[$130>>2]|0; //@line 325 "../../src/tiny_ekf/tiny_ekf.c"
  $132 = $6; //@line 325 "../../src/tiny_ekf/tiny_ekf.c"
  $133 = $7; //@line 325 "../../src/tiny_ekf/tiny_ekf.c"
  $134 = $6; //@line 325 "../../src/tiny_ekf/tiny_ekf.c"
  _mulmat($127,$129,$131,$132,$133,$134); //@line 325 "../../src/tiny_ekf/tiny_ekf.c"
  $135 = ((($8)) + 48|0); //@line 326 "../../src/tiny_ekf/tiny_ekf.c"
  $136 = HEAP32[$135>>2]|0; //@line 326 "../../src/tiny_ekf/tiny_ekf.c"
  $137 = $6; //@line 326 "../../src/tiny_ekf/tiny_ekf.c"
  $138 = $6; //@line 326 "../../src/tiny_ekf/tiny_ekf.c"
  _negate($136,$137,$138); //@line 326 "../../src/tiny_ekf/tiny_ekf.c"
  $139 = ((($8)) + 48|0); //@line 327 "../../src/tiny_ekf/tiny_ekf.c"
  $140 = HEAP32[$139>>2]|0; //@line 327 "../../src/tiny_ekf/tiny_ekf.c"
  $141 = $6; //@line 327 "../../src/tiny_ekf/tiny_ekf.c"
  _mat_addeye($140,$141); //@line 327 "../../src/tiny_ekf/tiny_ekf.c"
  $142 = ((($8)) + 48|0); //@line 328 "../../src/tiny_ekf/tiny_ekf.c"
  $143 = HEAP32[$142>>2]|0; //@line 328 "../../src/tiny_ekf/tiny_ekf.c"
  $144 = ((($8)) + 36|0); //@line 328 "../../src/tiny_ekf/tiny_ekf.c"
  $145 = HEAP32[$144>>2]|0; //@line 328 "../../src/tiny_ekf/tiny_ekf.c"
  $146 = ((($8)) + 4|0); //@line 328 "../../src/tiny_ekf/tiny_ekf.c"
  $147 = HEAP32[$146>>2]|0; //@line 328 "../../src/tiny_ekf/tiny_ekf.c"
  $148 = $6; //@line 328 "../../src/tiny_ekf/tiny_ekf.c"
  $149 = $6; //@line 328 "../../src/tiny_ekf/tiny_ekf.c"
  $150 = $6; //@line 328 "../../src/tiny_ekf/tiny_ekf.c"
  _mulmat($143,$145,$147,$148,$149,$150); //@line 328 "../../src/tiny_ekf/tiny_ekf.c"
  $2 = 0; //@line 331 "../../src/tiny_ekf/tiny_ekf.c"
  $151 = $2; //@line 332 "../../src/tiny_ekf/tiny_ekf.c"
  STACKTOP = sp;return ($151|0); //@line 332 "../../src/tiny_ekf/tiny_ekf.c"
 }
 return (0)|0;
}
function _mulmat($0,$1,$2,$3,$4,$5) {
 $0 = $0|0;
 $1 = $1|0;
 $2 = $2|0;
 $3 = $3|0;
 $4 = $4|0;
 $5 = $5|0;
 var $10 = 0, $11 = 0, $12 = 0, $13 = 0, $14 = 0, $15 = 0, $16 = 0, $17 = 0, $18 = 0, $19 = 0, $20 = 0, $21 = 0, $22 = 0, $23 = 0, $24 = 0, $25 = 0, $26 = 0, $27 = 0, $28 = 0, $29 = 0;
 var $30 = 0, $31 = 0, $32 = 0, $33 = 0, $34 = 0, $35 = 0, $36 = 0, $37 = 0, $38 = 0.0, $39 = 0, $40 = 0, $41 = 0, $42 = 0, $43 = 0, $44 = 0, $45 = 0, $46 = 0.0, $47 = 0.0, $48 = 0, $49 = 0;
 var $50 = 0, $51 = 0, $52 = 0, $53 = 0, $54 = 0, $55 = 0.0, $56 = 0.0, $57 = 0, $58 = 0, $59 = 0, $6 = 0, $60 = 0, $61 = 0, $62 = 0, $7 = 0, $8 = 0, $9 = 0, label = 0, sp = 0;
 sp = STACKTOP;
 STACKTOP = STACKTOP + 48|0; if ((STACKTOP|0) >= (STACK_MAX|0)) abortStackOverflow(48|0);
 $6 = $0;
 $7 = $1;
 $8 = $2;
 $9 = $3;
 $10 = $4;
 $11 = $5;
 $12 = 0; //@line 119 "../../src/tiny_ekf/tiny_ekf.c"
 while(1) {
  $15 = $12; //@line 119 "../../src/tiny_ekf/tiny_ekf.c"
  $16 = $9; //@line 119 "../../src/tiny_ekf/tiny_ekf.c"
  $17 = ($15|0)<($16|0); //@line 119 "../../src/tiny_ekf/tiny_ekf.c"
  if (!($17)) {
   break;
  }
  $13 = 0; //@line 120 "../../src/tiny_ekf/tiny_ekf.c"
  while(1) {
   $18 = $13; //@line 120 "../../src/tiny_ekf/tiny_ekf.c"
   $19 = $11; //@line 120 "../../src/tiny_ekf/tiny_ekf.c"
   $20 = ($18|0)<($19|0); //@line 120 "../../src/tiny_ekf/tiny_ekf.c"
   if (!($20)) {
    break;
   }
   $21 = $8; //@line 121 "../../src/tiny_ekf/tiny_ekf.c"
   $22 = $12; //@line 121 "../../src/tiny_ekf/tiny_ekf.c"
   $23 = $11; //@line 121 "../../src/tiny_ekf/tiny_ekf.c"
   $24 = Math_imul($22, $23)|0; //@line 121 "../../src/tiny_ekf/tiny_ekf.c"
   $25 = $13; //@line 121 "../../src/tiny_ekf/tiny_ekf.c"
   $26 = (($24) + ($25))|0; //@line 121 "../../src/tiny_ekf/tiny_ekf.c"
   $27 = (($21) + ($26<<3)|0); //@line 121 "../../src/tiny_ekf/tiny_ekf.c"
   HEAPF64[$27>>3] = 0.0; //@line 121 "../../src/tiny_ekf/tiny_ekf.c"
   $14 = 0; //@line 122 "../../src/tiny_ekf/tiny_ekf.c"
   while(1) {
    $28 = $14; //@line 122 "../../src/tiny_ekf/tiny_ekf.c"
    $29 = $10; //@line 122 "../../src/tiny_ekf/tiny_ekf.c"
    $30 = ($28|0)<($29|0); //@line 122 "../../src/tiny_ekf/tiny_ekf.c"
    if (!($30)) {
     break;
    }
    $31 = $6; //@line 123 "../../src/tiny_ekf/tiny_ekf.c"
    $32 = $12; //@line 123 "../../src/tiny_ekf/tiny_ekf.c"
    $33 = $10; //@line 123 "../../src/tiny_ekf/tiny_ekf.c"
    $34 = Math_imul($32, $33)|0; //@line 123 "../../src/tiny_ekf/tiny_ekf.c"
    $35 = $14; //@line 123 "../../src/tiny_ekf/tiny_ekf.c"
    $36 = (($34) + ($35))|0; //@line 123 "../../src/tiny_ekf/tiny_ekf.c"
    $37 = (($31) + ($36<<3)|0); //@line 123 "../../src/tiny_ekf/tiny_ekf.c"
    $38 = +HEAPF64[$37>>3]; //@line 123 "../../src/tiny_ekf/tiny_ekf.c"
    $39 = $7; //@line 123 "../../src/tiny_ekf/tiny_ekf.c"
    $40 = $14; //@line 123 "../../src/tiny_ekf/tiny_ekf.c"
    $41 = $11; //@line 123 "../../src/tiny_ekf/tiny_ekf.c"
    $42 = Math_imul($40, $41)|0; //@line 123 "../../src/tiny_ekf/tiny_ekf.c"
    $43 = $13; //@line 123 "../../src/tiny_ekf/tiny_ekf.c"
    $44 = (($42) + ($43))|0; //@line 123 "../../src/tiny_ekf/tiny_ekf.c"
    $45 = (($39) + ($44<<3)|0); //@line 123 "../../src/tiny_ekf/tiny_ekf.c"
    $46 = +HEAPF64[$45>>3]; //@line 123 "../../src/tiny_ekf/tiny_ekf.c"
    $47 = $38 * $46; //@line 123 "../../src/tiny_ekf/tiny_ekf.c"
    $48 = $8; //@line 123 "../../src/tiny_ekf/tiny_ekf.c"
    $49 = $12; //@line 123 "../../src/tiny_ekf/tiny_ekf.c"
    $50 = $11; //@line 123 "../../src/tiny_ekf/tiny_ekf.c"
    $51 = Math_imul($49, $50)|0; //@line 123 "../../src/tiny_ekf/tiny_ekf.c"
    $52 = $13; //@line 123 "../../src/tiny_ekf/tiny_ekf.c"
    $53 = (($51) + ($52))|0; //@line 123 "../../src/tiny_ekf/tiny_ekf.c"
    $54 = (($48) + ($53<<3)|0); //@line 123 "../../src/tiny_ekf/tiny_ekf.c"
    $55 = +HEAPF64[$54>>3]; //@line 123 "../../src/tiny_ekf/tiny_ekf.c"
    $56 = $55 + $47; //@line 123 "../../src/tiny_ekf/tiny_ekf.c"
    HEAPF64[$54>>3] = $56; //@line 123 "../../src/tiny_ekf/tiny_ekf.c"
    $57 = $14; //@line 122 "../../src/tiny_ekf/tiny_ekf.c"
    $58 = (($57) + 1)|0; //@line 122 "../../src/tiny_ekf/tiny_ekf.c"
    $14 = $58; //@line 122 "../../src/tiny_ekf/tiny_ekf.c"
   }
   $59 = $13; //@line 120 "../../src/tiny_ekf/tiny_ekf.c"
   $60 = (($59) + 1)|0; //@line 120 "../../src/tiny_ekf/tiny_ekf.c"
   $13 = $60; //@line 120 "../../src/tiny_ekf/tiny_ekf.c"
  }
  $61 = $12; //@line 119 "../../src/tiny_ekf/tiny_ekf.c"
  $62 = (($61) + 1)|0; //@line 119 "../../src/tiny_ekf/tiny_ekf.c"
  $12 = $62; //@line 119 "../../src/tiny_ekf/tiny_ekf.c"
 }
 STACKTOP = sp;return; //@line 125 "../../src/tiny_ekf/tiny_ekf.c"
}
function _transpose($0,$1,$2,$3) {
 $0 = $0|0;
 $1 = $1|0;
 $2 = $2|0;
 $3 = $3|0;
 var $10 = 0, $11 = 0, $12 = 0, $13 = 0, $14 = 0, $15 = 0, $16 = 0, $17 = 0, $18 = 0, $19 = 0, $20 = 0, $21 = 0, $22 = 0, $23 = 0.0, $24 = 0, $25 = 0, $26 = 0, $27 = 0, $28 = 0, $29 = 0;
 var $30 = 0, $31 = 0, $32 = 0, $33 = 0, $34 = 0, $4 = 0, $5 = 0, $6 = 0, $7 = 0, $8 = 0, $9 = 0, label = 0, sp = 0;
 sp = STACKTOP;
 STACKTOP = STACKTOP + 32|0; if ((STACKTOP|0) >= (STACK_MAX|0)) abortStackOverflow(32|0);
 $4 = $0;
 $5 = $1;
 $6 = $2;
 $7 = $3;
 $8 = 0; //@line 142 "../../src/tiny_ekf/tiny_ekf.c"
 while(1) {
  $10 = $8; //@line 142 "../../src/tiny_ekf/tiny_ekf.c"
  $11 = $6; //@line 142 "../../src/tiny_ekf/tiny_ekf.c"
  $12 = ($10|0)<($11|0); //@line 142 "../../src/tiny_ekf/tiny_ekf.c"
  if (!($12)) {
   break;
  }
  $9 = 0; //@line 143 "../../src/tiny_ekf/tiny_ekf.c"
  while(1) {
   $13 = $9; //@line 143 "../../src/tiny_ekf/tiny_ekf.c"
   $14 = $7; //@line 143 "../../src/tiny_ekf/tiny_ekf.c"
   $15 = ($13|0)<($14|0); //@line 143 "../../src/tiny_ekf/tiny_ekf.c"
   if (!($15)) {
    break;
   }
   $16 = $4; //@line 144 "../../src/tiny_ekf/tiny_ekf.c"
   $17 = $8; //@line 144 "../../src/tiny_ekf/tiny_ekf.c"
   $18 = $7; //@line 144 "../../src/tiny_ekf/tiny_ekf.c"
   $19 = Math_imul($17, $18)|0; //@line 144 "../../src/tiny_ekf/tiny_ekf.c"
   $20 = $9; //@line 144 "../../src/tiny_ekf/tiny_ekf.c"
   $21 = (($19) + ($20))|0; //@line 144 "../../src/tiny_ekf/tiny_ekf.c"
   $22 = (($16) + ($21<<3)|0); //@line 144 "../../src/tiny_ekf/tiny_ekf.c"
   $23 = +HEAPF64[$22>>3]; //@line 144 "../../src/tiny_ekf/tiny_ekf.c"
   $24 = $5; //@line 144 "../../src/tiny_ekf/tiny_ekf.c"
   $25 = $9; //@line 144 "../../src/tiny_ekf/tiny_ekf.c"
   $26 = $6; //@line 144 "../../src/tiny_ekf/tiny_ekf.c"
   $27 = Math_imul($25, $26)|0; //@line 144 "../../src/tiny_ekf/tiny_ekf.c"
   $28 = $8; //@line 144 "../../src/tiny_ekf/tiny_ekf.c"
   $29 = (($27) + ($28))|0; //@line 144 "../../src/tiny_ekf/tiny_ekf.c"
   $30 = (($24) + ($29<<3)|0); //@line 144 "../../src/tiny_ekf/tiny_ekf.c"
   HEAPF64[$30>>3] = $23; //@line 144 "../../src/tiny_ekf/tiny_ekf.c"
   $31 = $9; //@line 143 "../../src/tiny_ekf/tiny_ekf.c"
   $32 = (($31) + 1)|0; //@line 143 "../../src/tiny_ekf/tiny_ekf.c"
   $9 = $32; //@line 143 "../../src/tiny_ekf/tiny_ekf.c"
  }
  $33 = $8; //@line 142 "../../src/tiny_ekf/tiny_ekf.c"
  $34 = (($33) + 1)|0; //@line 142 "../../src/tiny_ekf/tiny_ekf.c"
  $8 = $34; //@line 142 "../../src/tiny_ekf/tiny_ekf.c"
 }
 STACKTOP = sp;return; //@line 146 "../../src/tiny_ekf/tiny_ekf.c"
}
function _accum($0,$1,$2,$3) {
 $0 = $0|0;
 $1 = $1|0;
 $2 = $2|0;
 $3 = $3|0;
 var $10 = 0, $11 = 0, $12 = 0, $13 = 0, $14 = 0, $15 = 0, $16 = 0, $17 = 0, $18 = 0, $19 = 0, $20 = 0, $21 = 0, $22 = 0, $23 = 0.0, $24 = 0, $25 = 0, $26 = 0, $27 = 0, $28 = 0, $29 = 0;
 var $30 = 0, $31 = 0.0, $32 = 0.0, $33 = 0, $34 = 0, $35 = 0, $36 = 0, $4 = 0, $5 = 0, $6 = 0, $7 = 0, $8 = 0, $9 = 0, label = 0, sp = 0;
 sp = STACKTOP;
 STACKTOP = STACKTOP + 32|0; if ((STACKTOP|0) >= (STACK_MAX|0)) abortStackOverflow(32|0);
 $4 = $0;
 $5 = $1;
 $6 = $2;
 $7 = $3;
 $8 = 0; //@line 153 "../../src/tiny_ekf/tiny_ekf.c"
 while(1) {
  $10 = $8; //@line 153 "../../src/tiny_ekf/tiny_ekf.c"
  $11 = $6; //@line 153 "../../src/tiny_ekf/tiny_ekf.c"
  $12 = ($10|0)<($11|0); //@line 153 "../../src/tiny_ekf/tiny_ekf.c"
  if (!($12)) {
   break;
  }
  $9 = 0; //@line 154 "../../src/tiny_ekf/tiny_ekf.c"
  while(1) {
   $13 = $9; //@line 154 "../../src/tiny_ekf/tiny_ekf.c"
   $14 = $7; //@line 154 "../../src/tiny_ekf/tiny_ekf.c"
   $15 = ($13|0)<($14|0); //@line 154 "../../src/tiny_ekf/tiny_ekf.c"
   if (!($15)) {
    break;
   }
   $16 = $5; //@line 155 "../../src/tiny_ekf/tiny_ekf.c"
   $17 = $8; //@line 155 "../../src/tiny_ekf/tiny_ekf.c"
   $18 = $7; //@line 155 "../../src/tiny_ekf/tiny_ekf.c"
   $19 = Math_imul($17, $18)|0; //@line 155 "../../src/tiny_ekf/tiny_ekf.c"
   $20 = $9; //@line 155 "../../src/tiny_ekf/tiny_ekf.c"
   $21 = (($19) + ($20))|0; //@line 155 "../../src/tiny_ekf/tiny_ekf.c"
   $22 = (($16) + ($21<<3)|0); //@line 155 "../../src/tiny_ekf/tiny_ekf.c"
   $23 = +HEAPF64[$22>>3]; //@line 155 "../../src/tiny_ekf/tiny_ekf.c"
   $24 = $4; //@line 155 "../../src/tiny_ekf/tiny_ekf.c"
   $25 = $8; //@line 155 "../../src/tiny_ekf/tiny_ekf.c"
   $26 = $7; //@line 155 "../../src/tiny_ekf/tiny_ekf.c"
   $27 = Math_imul($25, $26)|0; //@line 155 "../../src/tiny_ekf/tiny_ekf.c"
   $28 = $9; //@line 155 "../../src/tiny_ekf/tiny_ekf.c"
   $29 = (($27) + ($28))|0; //@line 155 "../../src/tiny_ekf/tiny_ekf.c"
   $30 = (($24) + ($29<<3)|0); //@line 155 "../../src/tiny_ekf/tiny_ekf.c"
   $31 = +HEAPF64[$30>>3]; //@line 155 "../../src/tiny_ekf/tiny_ekf.c"
   $32 = $31 + $23; //@line 155 "../../src/tiny_ekf/tiny_ekf.c"
   HEAPF64[$30>>3] = $32; //@line 155 "../../src/tiny_ekf/tiny_ekf.c"
   $33 = $9; //@line 154 "../../src/tiny_ekf/tiny_ekf.c"
   $34 = (($33) + 1)|0; //@line 154 "../../src/tiny_ekf/tiny_ekf.c"
   $9 = $34; //@line 154 "../../src/tiny_ekf/tiny_ekf.c"
  }
  $35 = $8; //@line 153 "../../src/tiny_ekf/tiny_ekf.c"
  $36 = (($35) + 1)|0; //@line 153 "../../src/tiny_ekf/tiny_ekf.c"
  $8 = $36; //@line 153 "../../src/tiny_ekf/tiny_ekf.c"
 }
 STACKTOP = sp;return; //@line 156 "../../src/tiny_ekf/tiny_ekf.c"
}
function _cholsl($0,$1,$2,$3) {
 $0 = $0|0;
 $1 = $1|0;
 $2 = $2|0;
 $3 = $3|0;
 var $10 = 0, $100 = 0, $101 = 0, $102 = 0, $103 = 0, $104 = 0, $105 = 0, $106 = 0.0, $107 = 0, $108 = 0, $109 = 0, $11 = 0, $110 = 0, $111 = 0, $112 = 0, $113 = 0, $114 = 0.0, $115 = 0.0, $116 = 0, $117 = 0;
 var $118 = 0, $119 = 0, $12 = 0, $120 = 0, $121 = 0, $122 = 0, $123 = 0.0, $124 = 0.0, $125 = 0, $126 = 0, $127 = 0, $128 = 0, $129 = 0, $13 = 0, $130 = 0, $131 = 0, $132 = 0, $133 = 0, $134 = 0, $135 = 0;
 var $136 = 0, $137 = 0, $138 = 0, $139 = 0, $14 = 0, $140 = 0, $141 = 0, $142 = 0, $143 = 0, $144 = 0.0, $145 = 0, $146 = 0, $147 = 0, $148 = 0, $149 = 0, $15 = 0, $150 = 0, $151 = 0, $152 = 0, $153 = 0;
 var $154 = 0, $155 = 0, $156 = 0, $16 = 0, $17 = 0, $18 = 0, $19 = 0, $20 = 0, $21 = 0, $22 = 0, $23 = 0, $24 = 0, $25 = 0, $26 = 0, $27 = 0, $28 = 0, $29 = 0, $30 = 0, $31 = 0, $32 = 0;
 var $33 = 0, $34 = 0, $35 = 0, $36 = 0, $37 = 0, $38 = 0, $39 = 0, $4 = 0, $40 = 0, $41 = 0, $42 = 0, $43 = 0, $44 = 0, $45 = 0, $46 = 0, $47 = 0.0, $48 = 0, $49 = 0, $5 = 0, $50 = 0;
 var $51 = 0, $52 = 0, $53 = 0, $54 = 0, $55 = 0.0, $56 = 0.0, $57 = 0, $58 = 0, $59 = 0, $6 = 0, $60 = 0, $61 = 0, $62 = 0, $63 = 0, $64 = 0, $65 = 0, $66 = 0, $67 = 0, $68 = 0, $69 = 0.0;
 var $7 = 0, $70 = 0, $71 = 0, $72 = 0, $73 = 0, $74 = 0, $75 = 0, $76 = 0, $77 = 0.0, $78 = 0.0, $79 = 0, $8 = 0, $80 = 0, $81 = 0, $82 = 0, $83 = 0, $84 = 0, $85 = 0, $86 = 0.0, $87 = 0.0;
 var $88 = 0, $89 = 0, $9 = 0, $90 = 0, $91 = 0, $92 = 0, $93 = 0, $94 = 0, $95 = 0, $96 = 0, $97 = 0, $98 = 0, $99 = 0, label = 0, sp = 0;
 sp = STACKTOP;
 STACKTOP = STACKTOP + 32|0; if ((STACKTOP|0) >= (STACK_MAX|0)) abortStackOverflow(32|0);
 $5 = $0;
 $6 = $1;
 $7 = $2;
 $8 = $3;
 $12 = $5; //@line 66 "../../src/tiny_ekf/tiny_ekf.c"
 $13 = $6; //@line 66 "../../src/tiny_ekf/tiny_ekf.c"
 $14 = $7; //@line 66 "../../src/tiny_ekf/tiny_ekf.c"
 $15 = $8; //@line 66 "../../src/tiny_ekf/tiny_ekf.c"
 $16 = (_choldcsl($12,$13,$14,$15)|0); //@line 66 "../../src/tiny_ekf/tiny_ekf.c"
 $17 = ($16|0)!=(0); //@line 66 "../../src/tiny_ekf/tiny_ekf.c"
 if ($17) {
  $4 = 1; //@line 66 "../../src/tiny_ekf/tiny_ekf.c"
  $156 = $4; //@line 90 "../../src/tiny_ekf/tiny_ekf.c"
  STACKTOP = sp;return ($156|0); //@line 90 "../../src/tiny_ekf/tiny_ekf.c"
 }
 $9 = 0; //@line 67 "../../src/tiny_ekf/tiny_ekf.c"
 while(1) {
  $18 = $9; //@line 67 "../../src/tiny_ekf/tiny_ekf.c"
  $19 = $8; //@line 67 "../../src/tiny_ekf/tiny_ekf.c"
  $20 = ($18|0)<($19|0); //@line 67 "../../src/tiny_ekf/tiny_ekf.c"
  if (!($20)) {
   break;
  }
  $21 = $9; //@line 68 "../../src/tiny_ekf/tiny_ekf.c"
  $22 = (($21) + 1)|0; //@line 68 "../../src/tiny_ekf/tiny_ekf.c"
  $10 = $22; //@line 68 "../../src/tiny_ekf/tiny_ekf.c"
  while(1) {
   $23 = $10; //@line 68 "../../src/tiny_ekf/tiny_ekf.c"
   $24 = $8; //@line 68 "../../src/tiny_ekf/tiny_ekf.c"
   $25 = ($23|0)<($24|0); //@line 68 "../../src/tiny_ekf/tiny_ekf.c"
   if (!($25)) {
    break;
   }
   $26 = $6; //@line 69 "../../src/tiny_ekf/tiny_ekf.c"
   $27 = $9; //@line 69 "../../src/tiny_ekf/tiny_ekf.c"
   $28 = $8; //@line 69 "../../src/tiny_ekf/tiny_ekf.c"
   $29 = Math_imul($27, $28)|0; //@line 69 "../../src/tiny_ekf/tiny_ekf.c"
   $30 = $10; //@line 69 "../../src/tiny_ekf/tiny_ekf.c"
   $31 = (($29) + ($30))|0; //@line 69 "../../src/tiny_ekf/tiny_ekf.c"
   $32 = (($26) + ($31<<3)|0); //@line 69 "../../src/tiny_ekf/tiny_ekf.c"
   HEAPF64[$32>>3] = 0.0; //@line 69 "../../src/tiny_ekf/tiny_ekf.c"
   $33 = $10; //@line 68 "../../src/tiny_ekf/tiny_ekf.c"
   $34 = (($33) + 1)|0; //@line 68 "../../src/tiny_ekf/tiny_ekf.c"
   $10 = $34; //@line 68 "../../src/tiny_ekf/tiny_ekf.c"
  }
  $35 = $9; //@line 67 "../../src/tiny_ekf/tiny_ekf.c"
  $36 = (($35) + 1)|0; //@line 67 "../../src/tiny_ekf/tiny_ekf.c"
  $9 = $36; //@line 67 "../../src/tiny_ekf/tiny_ekf.c"
 }
 $9 = 0; //@line 72 "../../src/tiny_ekf/tiny_ekf.c"
 while(1) {
  $37 = $9; //@line 72 "../../src/tiny_ekf/tiny_ekf.c"
  $38 = $8; //@line 72 "../../src/tiny_ekf/tiny_ekf.c"
  $39 = ($37|0)<($38|0); //@line 72 "../../src/tiny_ekf/tiny_ekf.c"
  if (!($39)) {
   break;
  }
  $40 = $6; //@line 73 "../../src/tiny_ekf/tiny_ekf.c"
  $41 = $9; //@line 73 "../../src/tiny_ekf/tiny_ekf.c"
  $42 = $8; //@line 73 "../../src/tiny_ekf/tiny_ekf.c"
  $43 = Math_imul($41, $42)|0; //@line 73 "../../src/tiny_ekf/tiny_ekf.c"
  $44 = $9; //@line 73 "../../src/tiny_ekf/tiny_ekf.c"
  $45 = (($43) + ($44))|0; //@line 73 "../../src/tiny_ekf/tiny_ekf.c"
  $46 = (($40) + ($45<<3)|0); //@line 73 "../../src/tiny_ekf/tiny_ekf.c"
  $47 = +HEAPF64[$46>>3]; //@line 73 "../../src/tiny_ekf/tiny_ekf.c"
  $48 = $6; //@line 73 "../../src/tiny_ekf/tiny_ekf.c"
  $49 = $9; //@line 73 "../../src/tiny_ekf/tiny_ekf.c"
  $50 = $8; //@line 73 "../../src/tiny_ekf/tiny_ekf.c"
  $51 = Math_imul($49, $50)|0; //@line 73 "../../src/tiny_ekf/tiny_ekf.c"
  $52 = $9; //@line 73 "../../src/tiny_ekf/tiny_ekf.c"
  $53 = (($51) + ($52))|0; //@line 73 "../../src/tiny_ekf/tiny_ekf.c"
  $54 = (($48) + ($53<<3)|0); //@line 73 "../../src/tiny_ekf/tiny_ekf.c"
  $55 = +HEAPF64[$54>>3]; //@line 73 "../../src/tiny_ekf/tiny_ekf.c"
  $56 = $55 * $47; //@line 73 "../../src/tiny_ekf/tiny_ekf.c"
  HEAPF64[$54>>3] = $56; //@line 73 "../../src/tiny_ekf/tiny_ekf.c"
  $57 = $9; //@line 74 "../../src/tiny_ekf/tiny_ekf.c"
  $58 = (($57) + 1)|0; //@line 74 "../../src/tiny_ekf/tiny_ekf.c"
  $11 = $58; //@line 74 "../../src/tiny_ekf/tiny_ekf.c"
  while(1) {
   $59 = $11; //@line 74 "../../src/tiny_ekf/tiny_ekf.c"
   $60 = $8; //@line 74 "../../src/tiny_ekf/tiny_ekf.c"
   $61 = ($59|0)<($60|0); //@line 74 "../../src/tiny_ekf/tiny_ekf.c"
   if (!($61)) {
    break;
   }
   $62 = $6; //@line 75 "../../src/tiny_ekf/tiny_ekf.c"
   $63 = $11; //@line 75 "../../src/tiny_ekf/tiny_ekf.c"
   $64 = $8; //@line 75 "../../src/tiny_ekf/tiny_ekf.c"
   $65 = Math_imul($63, $64)|0; //@line 75 "../../src/tiny_ekf/tiny_ekf.c"
   $66 = $9; //@line 75 "../../src/tiny_ekf/tiny_ekf.c"
   $67 = (($65) + ($66))|0; //@line 75 "../../src/tiny_ekf/tiny_ekf.c"
   $68 = (($62) + ($67<<3)|0); //@line 75 "../../src/tiny_ekf/tiny_ekf.c"
   $69 = +HEAPF64[$68>>3]; //@line 75 "../../src/tiny_ekf/tiny_ekf.c"
   $70 = $6; //@line 75 "../../src/tiny_ekf/tiny_ekf.c"
   $71 = $11; //@line 75 "../../src/tiny_ekf/tiny_ekf.c"
   $72 = $8; //@line 75 "../../src/tiny_ekf/tiny_ekf.c"
   $73 = Math_imul($71, $72)|0; //@line 75 "../../src/tiny_ekf/tiny_ekf.c"
   $74 = $9; //@line 75 "../../src/tiny_ekf/tiny_ekf.c"
   $75 = (($73) + ($74))|0; //@line 75 "../../src/tiny_ekf/tiny_ekf.c"
   $76 = (($70) + ($75<<3)|0); //@line 75 "../../src/tiny_ekf/tiny_ekf.c"
   $77 = +HEAPF64[$76>>3]; //@line 75 "../../src/tiny_ekf/tiny_ekf.c"
   $78 = $69 * $77; //@line 75 "../../src/tiny_ekf/tiny_ekf.c"
   $79 = $6; //@line 75 "../../src/tiny_ekf/tiny_ekf.c"
   $80 = $9; //@line 75 "../../src/tiny_ekf/tiny_ekf.c"
   $81 = $8; //@line 75 "../../src/tiny_ekf/tiny_ekf.c"
   $82 = Math_imul($80, $81)|0; //@line 75 "../../src/tiny_ekf/tiny_ekf.c"
   $83 = $9; //@line 75 "../../src/tiny_ekf/tiny_ekf.c"
   $84 = (($82) + ($83))|0; //@line 75 "../../src/tiny_ekf/tiny_ekf.c"
   $85 = (($79) + ($84<<3)|0); //@line 75 "../../src/tiny_ekf/tiny_ekf.c"
   $86 = +HEAPF64[$85>>3]; //@line 75 "../../src/tiny_ekf/tiny_ekf.c"
   $87 = $86 + $78; //@line 75 "../../src/tiny_ekf/tiny_ekf.c"
   HEAPF64[$85>>3] = $87; //@line 75 "../../src/tiny_ekf/tiny_ekf.c"
   $88 = $11; //@line 74 "../../src/tiny_ekf/tiny_ekf.c"
   $89 = (($88) + 1)|0; //@line 74 "../../src/tiny_ekf/tiny_ekf.c"
   $11 = $89; //@line 74 "../../src/tiny_ekf/tiny_ekf.c"
  }
  $90 = $9; //@line 77 "../../src/tiny_ekf/tiny_ekf.c"
  $91 = (($90) + 1)|0; //@line 77 "../../src/tiny_ekf/tiny_ekf.c"
  $10 = $91; //@line 77 "../../src/tiny_ekf/tiny_ekf.c"
  while(1) {
   $92 = $10; //@line 77 "../../src/tiny_ekf/tiny_ekf.c"
   $93 = $8; //@line 77 "../../src/tiny_ekf/tiny_ekf.c"
   $94 = ($92|0)<($93|0); //@line 77 "../../src/tiny_ekf/tiny_ekf.c"
   if (!($94)) {
    break;
   }
   $95 = $10; //@line 78 "../../src/tiny_ekf/tiny_ekf.c"
   $11 = $95; //@line 78 "../../src/tiny_ekf/tiny_ekf.c"
   while(1) {
    $96 = $11; //@line 78 "../../src/tiny_ekf/tiny_ekf.c"
    $97 = $8; //@line 78 "../../src/tiny_ekf/tiny_ekf.c"
    $98 = ($96|0)<($97|0); //@line 78 "../../src/tiny_ekf/tiny_ekf.c"
    if (!($98)) {
     break;
    }
    $99 = $6; //@line 79 "../../src/tiny_ekf/tiny_ekf.c"
    $100 = $11; //@line 79 "../../src/tiny_ekf/tiny_ekf.c"
    $101 = $8; //@line 79 "../../src/tiny_ekf/tiny_ekf.c"
    $102 = Math_imul($100, $101)|0; //@line 79 "../../src/tiny_ekf/tiny_ekf.c"
    $103 = $9; //@line 79 "../../src/tiny_ekf/tiny_ekf.c"
    $104 = (($102) + ($103))|0; //@line 79 "../../src/tiny_ekf/tiny_ekf.c"
    $105 = (($99) + ($104<<3)|0); //@line 79 "../../src/tiny_ekf/tiny_ekf.c"
    $106 = +HEAPF64[$105>>3]; //@line 79 "../../src/tiny_ekf/tiny_ekf.c"
    $107 = $6; //@line 79 "../../src/tiny_ekf/tiny_ekf.c"
    $108 = $11; //@line 79 "../../src/tiny_ekf/tiny_ekf.c"
    $109 = $8; //@line 79 "../../src/tiny_ekf/tiny_ekf.c"
    $110 = Math_imul($108, $109)|0; //@line 79 "../../src/tiny_ekf/tiny_ekf.c"
    $111 = $10; //@line 79 "../../src/tiny_ekf/tiny_ekf.c"
    $112 = (($110) + ($111))|0; //@line 79 "../../src/tiny_ekf/tiny_ekf.c"
    $113 = (($107) + ($112<<3)|0); //@line 79 "../../src/tiny_ekf/tiny_ekf.c"
    $114 = +HEAPF64[$113>>3]; //@line 79 "../../src/tiny_ekf/tiny_ekf.c"
    $115 = $106 * $114; //@line 79 "../../src/tiny_ekf/tiny_ekf.c"
    $116 = $6; //@line 79 "../../src/tiny_ekf/tiny_ekf.c"
    $117 = $9; //@line 79 "../../src/tiny_ekf/tiny_ekf.c"
    $118 = $8; //@line 79 "../../src/tiny_ekf/tiny_ekf.c"
    $119 = Math_imul($117, $118)|0; //@line 79 "../../src/tiny_ekf/tiny_ekf.c"
    $120 = $10; //@line 79 "../../src/tiny_ekf/tiny_ekf.c"
    $121 = (($119) + ($120))|0; //@line 79 "../../src/tiny_ekf/tiny_ekf.c"
    $122 = (($116) + ($121<<3)|0); //@line 79 "../../src/tiny_ekf/tiny_ekf.c"
    $123 = +HEAPF64[$122>>3]; //@line 79 "../../src/tiny_ekf/tiny_ekf.c"
    $124 = $123 + $115; //@line 79 "../../src/tiny_ekf/tiny_ekf.c"
    HEAPF64[$122>>3] = $124; //@line 79 "../../src/tiny_ekf/tiny_ekf.c"
    $125 = $11; //@line 78 "../../src/tiny_ekf/tiny_ekf.c"
    $126 = (($125) + 1)|0; //@line 78 "../../src/tiny_ekf/tiny_ekf.c"
    $11 = $126; //@line 78 "../../src/tiny_ekf/tiny_ekf.c"
   }
   $127 = $10; //@line 77 "../../src/tiny_ekf/tiny_ekf.c"
   $128 = (($127) + 1)|0; //@line 77 "../../src/tiny_ekf/tiny_ekf.c"
   $10 = $128; //@line 77 "../../src/tiny_ekf/tiny_ekf.c"
  }
  $129 = $9; //@line 72 "../../src/tiny_ekf/tiny_ekf.c"
  $130 = (($129) + 1)|0; //@line 72 "../../src/tiny_ekf/tiny_ekf.c"
  $9 = $130; //@line 72 "../../src/tiny_ekf/tiny_ekf.c"
 }
 $9 = 0; //@line 83 "../../src/tiny_ekf/tiny_ekf.c"
 while(1) {
  $131 = $9; //@line 83 "../../src/tiny_ekf/tiny_ekf.c"
  $132 = $8; //@line 83 "../../src/tiny_ekf/tiny_ekf.c"
  $133 = ($131|0)<($132|0); //@line 83 "../../src/tiny_ekf/tiny_ekf.c"
  if (!($133)) {
   break;
  }
  $10 = 0; //@line 84 "../../src/tiny_ekf/tiny_ekf.c"
  while(1) {
   $134 = $10; //@line 84 "../../src/tiny_ekf/tiny_ekf.c"
   $135 = $9; //@line 84 "../../src/tiny_ekf/tiny_ekf.c"
   $136 = ($134|0)<($135|0); //@line 84 "../../src/tiny_ekf/tiny_ekf.c"
   if (!($136)) {
    break;
   }
   $137 = $6; //@line 85 "../../src/tiny_ekf/tiny_ekf.c"
   $138 = $10; //@line 85 "../../src/tiny_ekf/tiny_ekf.c"
   $139 = $8; //@line 85 "../../src/tiny_ekf/tiny_ekf.c"
   $140 = Math_imul($138, $139)|0; //@line 85 "../../src/tiny_ekf/tiny_ekf.c"
   $141 = $9; //@line 85 "../../src/tiny_ekf/tiny_ekf.c"
   $142 = (($140) + ($141))|0; //@line 85 "../../src/tiny_ekf/tiny_ekf.c"
   $143 = (($137) + ($142<<3)|0); //@line 85 "../../src/tiny_ekf/tiny_ekf.c"
   $144 = +HEAPF64[$143>>3]; //@line 85 "../../src/tiny_ekf/tiny_ekf.c"
   $145 = $6; //@line 85 "../../src/tiny_ekf/tiny_ekf.c"
   $146 = $9; //@line 85 "../../src/tiny_ekf/tiny_ekf.c"
   $147 = $8; //@line 85 "../../src/tiny_ekf/tiny_ekf.c"
   $148 = Math_imul($146, $147)|0; //@line 85 "../../src/tiny_ekf/tiny_ekf.c"
   $149 = $10; //@line 85 "../../src/tiny_ekf/tiny_ekf.c"
   $150 = (($148) + ($149))|0; //@line 85 "../../src/tiny_ekf/tiny_ekf.c"
   $151 = (($145) + ($150<<3)|0); //@line 85 "../../src/tiny_ekf/tiny_ekf.c"
   HEAPF64[$151>>3] = $144; //@line 85 "../../src/tiny_ekf/tiny_ekf.c"
   $152 = $10; //@line 84 "../../src/tiny_ekf/tiny_ekf.c"
   $153 = (($152) + 1)|0; //@line 84 "../../src/tiny_ekf/tiny_ekf.c"
   $10 = $153; //@line 84 "../../src/tiny_ekf/tiny_ekf.c"
  }
  $154 = $9; //@line 83 "../../src/tiny_ekf/tiny_ekf.c"
  $155 = (($154) + 1)|0; //@line 83 "../../src/tiny_ekf/tiny_ekf.c"
  $9 = $155; //@line 83 "../../src/tiny_ekf/tiny_ekf.c"
 }
 $4 = 0; //@line 89 "../../src/tiny_ekf/tiny_ekf.c"
 $156 = $4; //@line 90 "../../src/tiny_ekf/tiny_ekf.c"
 STACKTOP = sp;return ($156|0); //@line 90 "../../src/tiny_ekf/tiny_ekf.c"
}
function _sub($0,$1,$2,$3) {
 $0 = $0|0;
 $1 = $1|0;
 $2 = $2|0;
 $3 = $3|0;
 var $10 = 0, $11 = 0, $12 = 0, $13 = 0, $14 = 0, $15 = 0.0, $16 = 0, $17 = 0, $18 = 0, $19 = 0.0, $20 = 0.0, $21 = 0, $22 = 0, $23 = 0, $24 = 0, $25 = 0, $4 = 0, $5 = 0, $6 = 0, $7 = 0;
 var $8 = 0, $9 = 0, label = 0, sp = 0;
 sp = STACKTOP;
 STACKTOP = STACKTOP + 32|0; if ((STACKTOP|0) >= (STACK_MAX|0)) abortStackOverflow(32|0);
 $4 = $0;
 $5 = $1;
 $6 = $2;
 $7 = $3;
 $8 = 0; //@line 173 "../../src/tiny_ekf/tiny_ekf.c"
 while(1) {
  $9 = $8; //@line 173 "../../src/tiny_ekf/tiny_ekf.c"
  $10 = $7; //@line 173 "../../src/tiny_ekf/tiny_ekf.c"
  $11 = ($9|0)<($10|0); //@line 173 "../../src/tiny_ekf/tiny_ekf.c"
  if (!($11)) {
   break;
  }
  $12 = $4; //@line 174 "../../src/tiny_ekf/tiny_ekf.c"
  $13 = $8; //@line 174 "../../src/tiny_ekf/tiny_ekf.c"
  $14 = (($12) + ($13<<3)|0); //@line 174 "../../src/tiny_ekf/tiny_ekf.c"
  $15 = +HEAPF64[$14>>3]; //@line 174 "../../src/tiny_ekf/tiny_ekf.c"
  $16 = $5; //@line 174 "../../src/tiny_ekf/tiny_ekf.c"
  $17 = $8; //@line 174 "../../src/tiny_ekf/tiny_ekf.c"
  $18 = (($16) + ($17<<3)|0); //@line 174 "../../src/tiny_ekf/tiny_ekf.c"
  $19 = +HEAPF64[$18>>3]; //@line 174 "../../src/tiny_ekf/tiny_ekf.c"
  $20 = $15 - $19; //@line 174 "../../src/tiny_ekf/tiny_ekf.c"
  $21 = $6; //@line 174 "../../src/tiny_ekf/tiny_ekf.c"
  $22 = $8; //@line 174 "../../src/tiny_ekf/tiny_ekf.c"
  $23 = (($21) + ($22<<3)|0); //@line 174 "../../src/tiny_ekf/tiny_ekf.c"
  HEAPF64[$23>>3] = $20; //@line 174 "../../src/tiny_ekf/tiny_ekf.c"
  $24 = $8; //@line 173 "../../src/tiny_ekf/tiny_ekf.c"
  $25 = (($24) + 1)|0; //@line 173 "../../src/tiny_ekf/tiny_ekf.c"
  $8 = $25; //@line 173 "../../src/tiny_ekf/tiny_ekf.c"
 }
 STACKTOP = sp;return; //@line 175 "../../src/tiny_ekf/tiny_ekf.c"
}
function _mulvec($0,$1,$2,$3,$4) {
 $0 = $0|0;
 $1 = $1|0;
 $2 = $2|0;
 $3 = $3|0;
 $4 = $4|0;
 var $10 = 0, $11 = 0, $12 = 0, $13 = 0, $14 = 0, $15 = 0, $16 = 0, $17 = 0, $18 = 0, $19 = 0, $20 = 0, $21 = 0, $22 = 0, $23 = 0, $24 = 0.0, $25 = 0, $26 = 0, $27 = 0, $28 = 0, $29 = 0;
 var $30 = 0, $31 = 0, $32 = 0.0, $33 = 0.0, $34 = 0, $35 = 0, $36 = 0, $37 = 0.0, $38 = 0.0, $39 = 0, $40 = 0, $41 = 0, $42 = 0, $5 = 0, $6 = 0, $7 = 0, $8 = 0, $9 = 0, label = 0, sp = 0;
 sp = STACKTOP;
 STACKTOP = STACKTOP + 32|0; if ((STACKTOP|0) >= (STACK_MAX|0)) abortStackOverflow(32|0);
 $5 = $0;
 $6 = $1;
 $7 = $2;
 $8 = $3;
 $9 = $4;
 $10 = 0; //@line 131 "../../src/tiny_ekf/tiny_ekf.c"
 while(1) {
  $12 = $10; //@line 131 "../../src/tiny_ekf/tiny_ekf.c"
  $13 = $8; //@line 131 "../../src/tiny_ekf/tiny_ekf.c"
  $14 = ($12|0)<($13|0); //@line 131 "../../src/tiny_ekf/tiny_ekf.c"
  if (!($14)) {
   break;
  }
  $15 = $7; //@line 132 "../../src/tiny_ekf/tiny_ekf.c"
  $16 = $10; //@line 132 "../../src/tiny_ekf/tiny_ekf.c"
  $17 = (($15) + ($16<<3)|0); //@line 132 "../../src/tiny_ekf/tiny_ekf.c"
  HEAPF64[$17>>3] = 0.0; //@line 132 "../../src/tiny_ekf/tiny_ekf.c"
  $11 = 0; //@line 133 "../../src/tiny_ekf/tiny_ekf.c"
  while(1) {
   $18 = $11; //@line 133 "../../src/tiny_ekf/tiny_ekf.c"
   $19 = $9; //@line 133 "../../src/tiny_ekf/tiny_ekf.c"
   $20 = ($18|0)<($19|0); //@line 133 "../../src/tiny_ekf/tiny_ekf.c"
   if (!($20)) {
    break;
   }
   $21 = $6; //@line 134 "../../src/tiny_ekf/tiny_ekf.c"
   $22 = $11; //@line 134 "../../src/tiny_ekf/tiny_ekf.c"
   $23 = (($21) + ($22<<3)|0); //@line 134 "../../src/tiny_ekf/tiny_ekf.c"
   $24 = +HEAPF64[$23>>3]; //@line 134 "../../src/tiny_ekf/tiny_ekf.c"
   $25 = $5; //@line 134 "../../src/tiny_ekf/tiny_ekf.c"
   $26 = $10; //@line 134 "../../src/tiny_ekf/tiny_ekf.c"
   $27 = $9; //@line 134 "../../src/tiny_ekf/tiny_ekf.c"
   $28 = Math_imul($26, $27)|0; //@line 134 "../../src/tiny_ekf/tiny_ekf.c"
   $29 = $11; //@line 134 "../../src/tiny_ekf/tiny_ekf.c"
   $30 = (($28) + ($29))|0; //@line 134 "../../src/tiny_ekf/tiny_ekf.c"
   $31 = (($25) + ($30<<3)|0); //@line 134 "../../src/tiny_ekf/tiny_ekf.c"
   $32 = +HEAPF64[$31>>3]; //@line 134 "../../src/tiny_ekf/tiny_ekf.c"
   $33 = $24 * $32; //@line 134 "../../src/tiny_ekf/tiny_ekf.c"
   $34 = $7; //@line 134 "../../src/tiny_ekf/tiny_ekf.c"
   $35 = $10; //@line 134 "../../src/tiny_ekf/tiny_ekf.c"
   $36 = (($34) + ($35<<3)|0); //@line 134 "../../src/tiny_ekf/tiny_ekf.c"
   $37 = +HEAPF64[$36>>3]; //@line 134 "../../src/tiny_ekf/tiny_ekf.c"
   $38 = $37 + $33; //@line 134 "../../src/tiny_ekf/tiny_ekf.c"
   HEAPF64[$36>>3] = $38; //@line 134 "../../src/tiny_ekf/tiny_ekf.c"
   $39 = $11; //@line 133 "../../src/tiny_ekf/tiny_ekf.c"
   $40 = (($39) + 1)|0; //@line 133 "../../src/tiny_ekf/tiny_ekf.c"
   $11 = $40; //@line 133 "../../src/tiny_ekf/tiny_ekf.c"
  }
  $41 = $10; //@line 131 "../../src/tiny_ekf/tiny_ekf.c"
  $42 = (($41) + 1)|0; //@line 131 "../../src/tiny_ekf/tiny_ekf.c"
  $10 = $42; //@line 131 "../../src/tiny_ekf/tiny_ekf.c"
 }
 STACKTOP = sp;return; //@line 136 "../../src/tiny_ekf/tiny_ekf.c"
}
function _add($0,$1,$2,$3) {
 $0 = $0|0;
 $1 = $1|0;
 $2 = $2|0;
 $3 = $3|0;
 var $10 = 0, $11 = 0, $12 = 0, $13 = 0, $14 = 0, $15 = 0.0, $16 = 0, $17 = 0, $18 = 0, $19 = 0.0, $20 = 0.0, $21 = 0, $22 = 0, $23 = 0, $24 = 0, $25 = 0, $4 = 0, $5 = 0, $6 = 0, $7 = 0;
 var $8 = 0, $9 = 0, label = 0, sp = 0;
 sp = STACKTOP;
 STACKTOP = STACKTOP + 32|0; if ((STACKTOP|0) >= (STACK_MAX|0)) abortStackOverflow(32|0);
 $4 = $0;
 $5 = $1;
 $6 = $2;
 $7 = $3;
 $8 = 0; //@line 163 "../../src/tiny_ekf/tiny_ekf.c"
 while(1) {
  $9 = $8; //@line 163 "../../src/tiny_ekf/tiny_ekf.c"
  $10 = $7; //@line 163 "../../src/tiny_ekf/tiny_ekf.c"
  $11 = ($9|0)<($10|0); //@line 163 "../../src/tiny_ekf/tiny_ekf.c"
  if (!($11)) {
   break;
  }
  $12 = $4; //@line 164 "../../src/tiny_ekf/tiny_ekf.c"
  $13 = $8; //@line 164 "../../src/tiny_ekf/tiny_ekf.c"
  $14 = (($12) + ($13<<3)|0); //@line 164 "../../src/tiny_ekf/tiny_ekf.c"
  $15 = +HEAPF64[$14>>3]; //@line 164 "../../src/tiny_ekf/tiny_ekf.c"
  $16 = $5; //@line 164 "../../src/tiny_ekf/tiny_ekf.c"
  $17 = $8; //@line 164 "../../src/tiny_ekf/tiny_ekf.c"
  $18 = (($16) + ($17<<3)|0); //@line 164 "../../src/tiny_ekf/tiny_ekf.c"
  $19 = +HEAPF64[$18>>3]; //@line 164 "../../src/tiny_ekf/tiny_ekf.c"
  $20 = $15 + $19; //@line 164 "../../src/tiny_ekf/tiny_ekf.c"
  $21 = $6; //@line 164 "../../src/tiny_ekf/tiny_ekf.c"
  $22 = $8; //@line 164 "../../src/tiny_ekf/tiny_ekf.c"
  $23 = (($21) + ($22<<3)|0); //@line 164 "../../src/tiny_ekf/tiny_ekf.c"
  HEAPF64[$23>>3] = $20; //@line 164 "../../src/tiny_ekf/tiny_ekf.c"
  $24 = $8; //@line 163 "../../src/tiny_ekf/tiny_ekf.c"
  $25 = (($24) + 1)|0; //@line 163 "../../src/tiny_ekf/tiny_ekf.c"
  $8 = $25; //@line 163 "../../src/tiny_ekf/tiny_ekf.c"
 }
 STACKTOP = sp;return; //@line 165 "../../src/tiny_ekf/tiny_ekf.c"
}
function _negate($0,$1,$2) {
 $0 = $0|0;
 $1 = $1|0;
 $2 = $2|0;
 var $10 = 0, $11 = 0, $12 = 0, $13 = 0, $14 = 0, $15 = 0, $16 = 0, $17 = 0, $18 = 0, $19 = 0, $20 = 0, $21 = 0.0, $22 = 0.0, $23 = 0, $24 = 0, $25 = 0, $26 = 0, $27 = 0, $28 = 0, $29 = 0;
 var $3 = 0, $30 = 0, $31 = 0, $32 = 0, $33 = 0, $4 = 0, $5 = 0, $6 = 0, $7 = 0, $8 = 0, $9 = 0, label = 0, sp = 0;
 sp = STACKTOP;
 STACKTOP = STACKTOP + 32|0; if ((STACKTOP|0) >= (STACK_MAX|0)) abortStackOverflow(32|0);
 $3 = $0;
 $4 = $1;
 $5 = $2;
 $6 = 0; //@line 181 "../../src/tiny_ekf/tiny_ekf.c"
 while(1) {
  $8 = $6; //@line 181 "../../src/tiny_ekf/tiny_ekf.c"
  $9 = $4; //@line 181 "../../src/tiny_ekf/tiny_ekf.c"
  $10 = ($8|0)<($9|0); //@line 181 "../../src/tiny_ekf/tiny_ekf.c"
  if (!($10)) {
   break;
  }
  $7 = 0; //@line 182 "../../src/tiny_ekf/tiny_ekf.c"
  while(1) {
   $11 = $7; //@line 182 "../../src/tiny_ekf/tiny_ekf.c"
   $12 = $5; //@line 182 "../../src/tiny_ekf/tiny_ekf.c"
   $13 = ($11|0)<($12|0); //@line 182 "../../src/tiny_ekf/tiny_ekf.c"
   if (!($13)) {
    break;
   }
   $14 = $3; //@line 183 "../../src/tiny_ekf/tiny_ekf.c"
   $15 = $6; //@line 183 "../../src/tiny_ekf/tiny_ekf.c"
   $16 = $5; //@line 183 "../../src/tiny_ekf/tiny_ekf.c"
   $17 = Math_imul($15, $16)|0; //@line 183 "../../src/tiny_ekf/tiny_ekf.c"
   $18 = $7; //@line 183 "../../src/tiny_ekf/tiny_ekf.c"
   $19 = (($17) + ($18))|0; //@line 183 "../../src/tiny_ekf/tiny_ekf.c"
   $20 = (($14) + ($19<<3)|0); //@line 183 "../../src/tiny_ekf/tiny_ekf.c"
   $21 = +HEAPF64[$20>>3]; //@line 183 "../../src/tiny_ekf/tiny_ekf.c"
   $22 = - $21; //@line 183 "../../src/tiny_ekf/tiny_ekf.c"
   $23 = $3; //@line 183 "../../src/tiny_ekf/tiny_ekf.c"
   $24 = $6; //@line 183 "../../src/tiny_ekf/tiny_ekf.c"
   $25 = $5; //@line 183 "../../src/tiny_ekf/tiny_ekf.c"
   $26 = Math_imul($24, $25)|0; //@line 183 "../../src/tiny_ekf/tiny_ekf.c"
   $27 = $7; //@line 183 "../../src/tiny_ekf/tiny_ekf.c"
   $28 = (($26) + ($27))|0; //@line 183 "../../src/tiny_ekf/tiny_ekf.c"
   $29 = (($23) + ($28<<3)|0); //@line 183 "../../src/tiny_ekf/tiny_ekf.c"
   HEAPF64[$29>>3] = $22; //@line 183 "../../src/tiny_ekf/tiny_ekf.c"
   $30 = $7; //@line 182 "../../src/tiny_ekf/tiny_ekf.c"
   $31 = (($30) + 1)|0; //@line 182 "../../src/tiny_ekf/tiny_ekf.c"
   $7 = $31; //@line 182 "../../src/tiny_ekf/tiny_ekf.c"
  }
  $32 = $6; //@line 181 "../../src/tiny_ekf/tiny_ekf.c"
  $33 = (($32) + 1)|0; //@line 181 "../../src/tiny_ekf/tiny_ekf.c"
  $6 = $33; //@line 181 "../../src/tiny_ekf/tiny_ekf.c"
 }
 STACKTOP = sp;return; //@line 184 "../../src/tiny_ekf/tiny_ekf.c"
}
function _mat_addeye($0,$1) {
 $0 = $0|0;
 $1 = $1|0;
 var $10 = 0, $11 = 0, $12 = 0, $13 = 0, $14 = 0, $15 = 0.0, $16 = 0.0, $17 = 0, $18 = 0, $2 = 0, $3 = 0, $4 = 0, $5 = 0, $6 = 0, $7 = 0, $8 = 0, $9 = 0, label = 0, sp = 0;
 sp = STACKTOP;
 STACKTOP = STACKTOP + 16|0; if ((STACKTOP|0) >= (STACK_MAX|0)) abortStackOverflow(16|0);
 $2 = $0;
 $3 = $1;
 $4 = 0; //@line 189 "../../src/tiny_ekf/tiny_ekf.c"
 while(1) {
  $5 = $4; //@line 189 "../../src/tiny_ekf/tiny_ekf.c"
  $6 = $3; //@line 189 "../../src/tiny_ekf/tiny_ekf.c"
  $7 = ($5|0)<($6|0); //@line 189 "../../src/tiny_ekf/tiny_ekf.c"
  if (!($7)) {
   break;
  }
  $8 = $2; //@line 190 "../../src/tiny_ekf/tiny_ekf.c"
  $9 = $4; //@line 190 "../../src/tiny_ekf/tiny_ekf.c"
  $10 = $3; //@line 190 "../../src/tiny_ekf/tiny_ekf.c"
  $11 = Math_imul($9, $10)|0; //@line 190 "../../src/tiny_ekf/tiny_ekf.c"
  $12 = $4; //@line 190 "../../src/tiny_ekf/tiny_ekf.c"
  $13 = (($11) + ($12))|0; //@line 190 "../../src/tiny_ekf/tiny_ekf.c"
  $14 = (($8) + ($13<<3)|0); //@line 190 "../../src/tiny_ekf/tiny_ekf.c"
  $15 = +HEAPF64[$14>>3]; //@line 190 "../../src/tiny_ekf/tiny_ekf.c"
  $16 = $15 + 1.0; //@line 190 "../../src/tiny_ekf/tiny_ekf.c"
  HEAPF64[$14>>3] = $16; //@line 190 "../../src/tiny_ekf/tiny_ekf.c"
  $17 = $4; //@line 189 "../../src/tiny_ekf/tiny_ekf.c"
  $18 = (($17) + 1)|0; //@line 189 "../../src/tiny_ekf/tiny_ekf.c"
  $4 = $18; //@line 189 "../../src/tiny_ekf/tiny_ekf.c"
 }
 STACKTOP = sp;return; //@line 191 "../../src/tiny_ekf/tiny_ekf.c"
}
function _choldcsl($0,$1,$2,$3) {
 $0 = $0|0;
 $1 = $1|0;
 $2 = $2|0;
 $3 = $3|0;
 var $10 = 0, $100 = 0, $101 = 0, $102 = 0, $103 = 0, $104 = 0, $105 = 0, $11 = 0, $12 = 0.0, $13 = 0, $14 = 0, $15 = 0, $16 = 0, $17 = 0, $18 = 0, $19 = 0, $20 = 0, $21 = 0, $22 = 0, $23 = 0;
 var $24 = 0, $25 = 0, $26 = 0.0, $27 = 0, $28 = 0, $29 = 0, $30 = 0, $31 = 0, $32 = 0, $33 = 0, $34 = 0, $35 = 0, $36 = 0, $37 = 0, $38 = 0, $39 = 0, $4 = 0, $40 = 0, $41 = 0, $42 = 0;
 var $43 = 0, $44 = 0, $45 = 0, $46 = 0, $47 = 0, $48 = 0, $49 = 0.0, $5 = 0, $50 = 0.0, $51 = 0, $52 = 0, $53 = 0, $54 = 0, $55 = 0, $56 = 0, $57 = 0, $58 = 0, $59 = 0, $6 = 0, $60 = 0;
 var $61 = 0, $62 = 0, $63 = 0, $64 = 0, $65 = 0, $66 = 0, $67 = 0, $68 = 0, $69 = 0, $7 = 0, $70 = 0, $71 = 0, $72 = 0, $73 = 0, $74 = 0.0, $75 = 0, $76 = 0, $77 = 0, $78 = 0, $79 = 0;
 var $8 = 0, $80 = 0, $81 = 0, $82 = 0.0, $83 = 0.0, $84 = 0.0, $85 = 0.0, $86 = 0, $87 = 0, $88 = 0.0, $89 = 0, $9 = 0, $90 = 0, $91 = 0, $92 = 0.0, $93 = 0.0, $94 = 0, $95 = 0, $96 = 0, $97 = 0;
 var $98 = 0, $99 = 0, label = 0, sp = 0;
 sp = STACKTOP;
 STACKTOP = STACKTOP + 48|0; if ((STACKTOP|0) >= (STACK_MAX|0)) abortStackOverflow(48|0);
 $5 = $0;
 $6 = $1;
 $7 = $2;
 $8 = $3;
 $9 = 0; //@line 44 "../../src/tiny_ekf/tiny_ekf.c"
 while(1) {
  $13 = $9; //@line 44 "../../src/tiny_ekf/tiny_ekf.c"
  $14 = $8; //@line 44 "../../src/tiny_ekf/tiny_ekf.c"
  $15 = ($13|0)<($14|0); //@line 44 "../../src/tiny_ekf/tiny_ekf.c"
  if (!($15)) {
   break;
  }
  $10 = 0; //@line 45 "../../src/tiny_ekf/tiny_ekf.c"
  while(1) {
   $16 = $10; //@line 45 "../../src/tiny_ekf/tiny_ekf.c"
   $17 = $8; //@line 45 "../../src/tiny_ekf/tiny_ekf.c"
   $18 = ($16|0)<($17|0); //@line 45 "../../src/tiny_ekf/tiny_ekf.c"
   if (!($18)) {
    break;
   }
   $19 = $5; //@line 46 "../../src/tiny_ekf/tiny_ekf.c"
   $20 = $9; //@line 46 "../../src/tiny_ekf/tiny_ekf.c"
   $21 = $8; //@line 46 "../../src/tiny_ekf/tiny_ekf.c"
   $22 = Math_imul($20, $21)|0; //@line 46 "../../src/tiny_ekf/tiny_ekf.c"
   $23 = $10; //@line 46 "../../src/tiny_ekf/tiny_ekf.c"
   $24 = (($22) + ($23))|0; //@line 46 "../../src/tiny_ekf/tiny_ekf.c"
   $25 = (($19) + ($24<<3)|0); //@line 46 "../../src/tiny_ekf/tiny_ekf.c"
   $26 = +HEAPF64[$25>>3]; //@line 46 "../../src/tiny_ekf/tiny_ekf.c"
   $27 = $6; //@line 46 "../../src/tiny_ekf/tiny_ekf.c"
   $28 = $9; //@line 46 "../../src/tiny_ekf/tiny_ekf.c"
   $29 = $8; //@line 46 "../../src/tiny_ekf/tiny_ekf.c"
   $30 = Math_imul($28, $29)|0; //@line 46 "../../src/tiny_ekf/tiny_ekf.c"
   $31 = $10; //@line 46 "../../src/tiny_ekf/tiny_ekf.c"
   $32 = (($30) + ($31))|0; //@line 46 "../../src/tiny_ekf/tiny_ekf.c"
   $33 = (($27) + ($32<<3)|0); //@line 46 "../../src/tiny_ekf/tiny_ekf.c"
   HEAPF64[$33>>3] = $26; //@line 46 "../../src/tiny_ekf/tiny_ekf.c"
   $34 = $10; //@line 45 "../../src/tiny_ekf/tiny_ekf.c"
   $35 = (($34) + 1)|0; //@line 45 "../../src/tiny_ekf/tiny_ekf.c"
   $10 = $35; //@line 45 "../../src/tiny_ekf/tiny_ekf.c"
  }
  $36 = $9; //@line 44 "../../src/tiny_ekf/tiny_ekf.c"
  $37 = (($36) + 1)|0; //@line 44 "../../src/tiny_ekf/tiny_ekf.c"
  $9 = $37; //@line 44 "../../src/tiny_ekf/tiny_ekf.c"
 }
 $38 = $6; //@line 47 "../../src/tiny_ekf/tiny_ekf.c"
 $39 = $7; //@line 47 "../../src/tiny_ekf/tiny_ekf.c"
 $40 = $8; //@line 47 "../../src/tiny_ekf/tiny_ekf.c"
 $41 = (_choldc1($38,$39,$40)|0); //@line 47 "../../src/tiny_ekf/tiny_ekf.c"
 $42 = ($41|0)!=(0); //@line 47 "../../src/tiny_ekf/tiny_ekf.c"
 if ($42) {
  $4 = 1; //@line 47 "../../src/tiny_ekf/tiny_ekf.c"
  $105 = $4; //@line 60 "../../src/tiny_ekf/tiny_ekf.c"
  STACKTOP = sp;return ($105|0); //@line 60 "../../src/tiny_ekf/tiny_ekf.c"
 }
 $9 = 0; //@line 48 "../../src/tiny_ekf/tiny_ekf.c"
 while(1) {
  $43 = $9; //@line 48 "../../src/tiny_ekf/tiny_ekf.c"
  $44 = $8; //@line 48 "../../src/tiny_ekf/tiny_ekf.c"
  $45 = ($43|0)<($44|0); //@line 48 "../../src/tiny_ekf/tiny_ekf.c"
  if (!($45)) {
   break;
  }
  $46 = $7; //@line 49 "../../src/tiny_ekf/tiny_ekf.c"
  $47 = $9; //@line 49 "../../src/tiny_ekf/tiny_ekf.c"
  $48 = (($46) + ($47<<3)|0); //@line 49 "../../src/tiny_ekf/tiny_ekf.c"
  $49 = +HEAPF64[$48>>3]; //@line 49 "../../src/tiny_ekf/tiny_ekf.c"
  $50 = 1.0 / $49; //@line 49 "../../src/tiny_ekf/tiny_ekf.c"
  $51 = $6; //@line 49 "../../src/tiny_ekf/tiny_ekf.c"
  $52 = $9; //@line 49 "../../src/tiny_ekf/tiny_ekf.c"
  $53 = $8; //@line 49 "../../src/tiny_ekf/tiny_ekf.c"
  $54 = Math_imul($52, $53)|0; //@line 49 "../../src/tiny_ekf/tiny_ekf.c"
  $55 = $9; //@line 49 "../../src/tiny_ekf/tiny_ekf.c"
  $56 = (($54) + ($55))|0; //@line 49 "../../src/tiny_ekf/tiny_ekf.c"
  $57 = (($51) + ($56<<3)|0); //@line 49 "../../src/tiny_ekf/tiny_ekf.c"
  HEAPF64[$57>>3] = $50; //@line 49 "../../src/tiny_ekf/tiny_ekf.c"
  $58 = $9; //@line 50 "../../src/tiny_ekf/tiny_ekf.c"
  $59 = (($58) + 1)|0; //@line 50 "../../src/tiny_ekf/tiny_ekf.c"
  $10 = $59; //@line 50 "../../src/tiny_ekf/tiny_ekf.c"
  while(1) {
   $60 = $10; //@line 50 "../../src/tiny_ekf/tiny_ekf.c"
   $61 = $8; //@line 50 "../../src/tiny_ekf/tiny_ekf.c"
   $62 = ($60|0)<($61|0); //@line 50 "../../src/tiny_ekf/tiny_ekf.c"
   if (!($62)) {
    break;
   }
   $12 = 0.0; //@line 51 "../../src/tiny_ekf/tiny_ekf.c"
   $63 = $9; //@line 52 "../../src/tiny_ekf/tiny_ekf.c"
   $11 = $63; //@line 52 "../../src/tiny_ekf/tiny_ekf.c"
   while(1) {
    $64 = $11; //@line 52 "../../src/tiny_ekf/tiny_ekf.c"
    $65 = $10; //@line 52 "../../src/tiny_ekf/tiny_ekf.c"
    $66 = ($64|0)<($65|0); //@line 52 "../../src/tiny_ekf/tiny_ekf.c"
    if (!($66)) {
     break;
    }
    $67 = $6; //@line 53 "../../src/tiny_ekf/tiny_ekf.c"
    $68 = $10; //@line 53 "../../src/tiny_ekf/tiny_ekf.c"
    $69 = $8; //@line 53 "../../src/tiny_ekf/tiny_ekf.c"
    $70 = Math_imul($68, $69)|0; //@line 53 "../../src/tiny_ekf/tiny_ekf.c"
    $71 = $11; //@line 53 "../../src/tiny_ekf/tiny_ekf.c"
    $72 = (($70) + ($71))|0; //@line 53 "../../src/tiny_ekf/tiny_ekf.c"
    $73 = (($67) + ($72<<3)|0); //@line 53 "../../src/tiny_ekf/tiny_ekf.c"
    $74 = +HEAPF64[$73>>3]; //@line 53 "../../src/tiny_ekf/tiny_ekf.c"
    $75 = $6; //@line 53 "../../src/tiny_ekf/tiny_ekf.c"
    $76 = $11; //@line 53 "../../src/tiny_ekf/tiny_ekf.c"
    $77 = $8; //@line 53 "../../src/tiny_ekf/tiny_ekf.c"
    $78 = Math_imul($76, $77)|0; //@line 53 "../../src/tiny_ekf/tiny_ekf.c"
    $79 = $9; //@line 53 "../../src/tiny_ekf/tiny_ekf.c"
    $80 = (($78) + ($79))|0; //@line 53 "../../src/tiny_ekf/tiny_ekf.c"
    $81 = (($75) + ($80<<3)|0); //@line 53 "../../src/tiny_ekf/tiny_ekf.c"
    $82 = +HEAPF64[$81>>3]; //@line 53 "../../src/tiny_ekf/tiny_ekf.c"
    $83 = $74 * $82; //@line 53 "../../src/tiny_ekf/tiny_ekf.c"
    $84 = $12; //@line 53 "../../src/tiny_ekf/tiny_ekf.c"
    $85 = $84 - $83; //@line 53 "../../src/tiny_ekf/tiny_ekf.c"
    $12 = $85; //@line 53 "../../src/tiny_ekf/tiny_ekf.c"
    $86 = $11; //@line 52 "../../src/tiny_ekf/tiny_ekf.c"
    $87 = (($86) + 1)|0; //@line 52 "../../src/tiny_ekf/tiny_ekf.c"
    $11 = $87; //@line 52 "../../src/tiny_ekf/tiny_ekf.c"
   }
   $88 = $12; //@line 55 "../../src/tiny_ekf/tiny_ekf.c"
   $89 = $7; //@line 55 "../../src/tiny_ekf/tiny_ekf.c"
   $90 = $10; //@line 55 "../../src/tiny_ekf/tiny_ekf.c"
   $91 = (($89) + ($90<<3)|0); //@line 55 "../../src/tiny_ekf/tiny_ekf.c"
   $92 = +HEAPF64[$91>>3]; //@line 55 "../../src/tiny_ekf/tiny_ekf.c"
   $93 = $88 / $92; //@line 55 "../../src/tiny_ekf/tiny_ekf.c"
   $94 = $6; //@line 55 "../../src/tiny_ekf/tiny_ekf.c"
   $95 = $10; //@line 55 "../../src/tiny_ekf/tiny_ekf.c"
   $96 = $8; //@line 55 "../../src/tiny_ekf/tiny_ekf.c"
   $97 = Math_imul($95, $96)|0; //@line 55 "../../src/tiny_ekf/tiny_ekf.c"
   $98 = $9; //@line 55 "../../src/tiny_ekf/tiny_ekf.c"
   $99 = (($97) + ($98))|0; //@line 55 "../../src/tiny_ekf/tiny_ekf.c"
   $100 = (($94) + ($99<<3)|0); //@line 55 "../../src/tiny_ekf/tiny_ekf.c"
   HEAPF64[$100>>3] = $93; //@line 55 "../../src/tiny_ekf/tiny_ekf.c"
   $101 = $10; //@line 50 "../../src/tiny_ekf/tiny_ekf.c"
   $102 = (($101) + 1)|0; //@line 50 "../../src/tiny_ekf/tiny_ekf.c"
   $10 = $102; //@line 50 "../../src/tiny_ekf/tiny_ekf.c"
  }
  $103 = $9; //@line 48 "../../src/tiny_ekf/tiny_ekf.c"
  $104 = (($103) + 1)|0; //@line 48 "../../src/tiny_ekf/tiny_ekf.c"
  $9 = $104; //@line 48 "../../src/tiny_ekf/tiny_ekf.c"
 }
 $4 = 0; //@line 59 "../../src/tiny_ekf/tiny_ekf.c"
 $105 = $4; //@line 60 "../../src/tiny_ekf/tiny_ekf.c"
 STACKTOP = sp;return ($105|0); //@line 60 "../../src/tiny_ekf/tiny_ekf.c"
}
function _choldc1($0,$1,$2) {
 $0 = $0|0;
 $1 = $1|0;
 $2 = $2|0;
 var $10 = 0.0, $11 = 0, $12 = 0, $13 = 0, $14 = 0, $15 = 0, $16 = 0, $17 = 0, $18 = 0, $19 = 0, $20 = 0, $21 = 0, $22 = 0, $23 = 0, $24 = 0, $25 = 0.0, $26 = 0, $27 = 0, $28 = 0, $29 = 0;
 var $3 = 0, $30 = 0, $31 = 0, $32 = 0, $33 = 0, $34 = 0, $35 = 0, $36 = 0, $37 = 0.0, $38 = 0, $39 = 0, $4 = 0, $40 = 0, $41 = 0, $42 = 0, $43 = 0, $44 = 0, $45 = 0.0, $46 = 0.0, $47 = 0.0;
 var $48 = 0.0, $49 = 0, $5 = 0, $50 = 0, $51 = 0, $52 = 0, $53 = 0, $54 = 0.0, $55 = 0, $56 = 0.0, $57 = 0.0, $58 = 0, $59 = 0, $6 = 0, $60 = 0, $61 = 0, $62 = 0, $63 = 0, $64 = 0.0, $65 = 0.0;
 var $66 = 0, $67 = 0, $68 = 0, $69 = 0, $7 = 0, $70 = 0, $71 = 0, $72 = 0, $73 = 0, $74 = 0, $75 = 0, $76 = 0, $77 = 0, $8 = 0, $9 = 0, label = 0, sp = 0;
 sp = STACKTOP;
 STACKTOP = STACKTOP + 48|0; if ((STACKTOP|0) >= (STACK_MAX|0)) abortStackOverflow(48|0);
 $4 = $0;
 $5 = $1;
 $6 = $2;
 $7 = 0; //@line 20 "../../src/tiny_ekf/tiny_ekf.c"
 L1: while(1) {
  $11 = $7; //@line 20 "../../src/tiny_ekf/tiny_ekf.c"
  $12 = $6; //@line 20 "../../src/tiny_ekf/tiny_ekf.c"
  $13 = ($11|0)<($12|0); //@line 20 "../../src/tiny_ekf/tiny_ekf.c"
  if (!($13)) {
   label = 15;
   break;
  }
  $14 = $7; //@line 21 "../../src/tiny_ekf/tiny_ekf.c"
  $8 = $14; //@line 21 "../../src/tiny_ekf/tiny_ekf.c"
  while(1) {
   $15 = $8; //@line 21 "../../src/tiny_ekf/tiny_ekf.c"
   $16 = $6; //@line 21 "../../src/tiny_ekf/tiny_ekf.c"
   $17 = ($15|0)<($16|0); //@line 21 "../../src/tiny_ekf/tiny_ekf.c"
   if (!($17)) {
    break;
   }
   $18 = $4; //@line 22 "../../src/tiny_ekf/tiny_ekf.c"
   $19 = $7; //@line 22 "../../src/tiny_ekf/tiny_ekf.c"
   $20 = $6; //@line 22 "../../src/tiny_ekf/tiny_ekf.c"
   $21 = Math_imul($19, $20)|0; //@line 22 "../../src/tiny_ekf/tiny_ekf.c"
   $22 = $8; //@line 22 "../../src/tiny_ekf/tiny_ekf.c"
   $23 = (($21) + ($22))|0; //@line 22 "../../src/tiny_ekf/tiny_ekf.c"
   $24 = (($18) + ($23<<3)|0); //@line 22 "../../src/tiny_ekf/tiny_ekf.c"
   $25 = +HEAPF64[$24>>3]; //@line 22 "../../src/tiny_ekf/tiny_ekf.c"
   $10 = $25; //@line 22 "../../src/tiny_ekf/tiny_ekf.c"
   $26 = $7; //@line 23 "../../src/tiny_ekf/tiny_ekf.c"
   $27 = (($26) - 1)|0; //@line 23 "../../src/tiny_ekf/tiny_ekf.c"
   $9 = $27; //@line 23 "../../src/tiny_ekf/tiny_ekf.c"
   while(1) {
    $28 = $9; //@line 23 "../../src/tiny_ekf/tiny_ekf.c"
    $29 = ($28|0)>=(0); //@line 23 "../../src/tiny_ekf/tiny_ekf.c"
    if (!($29)) {
     break;
    }
    $30 = $4; //@line 24 "../../src/tiny_ekf/tiny_ekf.c"
    $31 = $7; //@line 24 "../../src/tiny_ekf/tiny_ekf.c"
    $32 = $6; //@line 24 "../../src/tiny_ekf/tiny_ekf.c"
    $33 = Math_imul($31, $32)|0; //@line 24 "../../src/tiny_ekf/tiny_ekf.c"
    $34 = $9; //@line 24 "../../src/tiny_ekf/tiny_ekf.c"
    $35 = (($33) + ($34))|0; //@line 24 "../../src/tiny_ekf/tiny_ekf.c"
    $36 = (($30) + ($35<<3)|0); //@line 24 "../../src/tiny_ekf/tiny_ekf.c"
    $37 = +HEAPF64[$36>>3]; //@line 24 "../../src/tiny_ekf/tiny_ekf.c"
    $38 = $4; //@line 24 "../../src/tiny_ekf/tiny_ekf.c"
    $39 = $8; //@line 24 "../../src/tiny_ekf/tiny_ekf.c"
    $40 = $6; //@line 24 "../../src/tiny_ekf/tiny_ekf.c"
    $41 = Math_imul($39, $40)|0; //@line 24 "../../src/tiny_ekf/tiny_ekf.c"
    $42 = $9; //@line 24 "../../src/tiny_ekf/tiny_ekf.c"
    $43 = (($41) + ($42))|0; //@line 24 "../../src/tiny_ekf/tiny_ekf.c"
    $44 = (($38) + ($43<<3)|0); //@line 24 "../../src/tiny_ekf/tiny_ekf.c"
    $45 = +HEAPF64[$44>>3]; //@line 24 "../../src/tiny_ekf/tiny_ekf.c"
    $46 = $37 * $45; //@line 24 "../../src/tiny_ekf/tiny_ekf.c"
    $47 = $10; //@line 24 "../../src/tiny_ekf/tiny_ekf.c"
    $48 = $47 - $46; //@line 24 "../../src/tiny_ekf/tiny_ekf.c"
    $10 = $48; //@line 24 "../../src/tiny_ekf/tiny_ekf.c"
    $49 = $9; //@line 23 "../../src/tiny_ekf/tiny_ekf.c"
    $50 = (($49) + -1)|0; //@line 23 "../../src/tiny_ekf/tiny_ekf.c"
    $9 = $50; //@line 23 "../../src/tiny_ekf/tiny_ekf.c"
   }
   $51 = $7; //@line 26 "../../src/tiny_ekf/tiny_ekf.c"
   $52 = $8; //@line 26 "../../src/tiny_ekf/tiny_ekf.c"
   $53 = ($51|0)==($52|0); //@line 26 "../../src/tiny_ekf/tiny_ekf.c"
   $54 = $10;
   if ($53) {
    $55 = $54 <= 0.0; //@line 27 "../../src/tiny_ekf/tiny_ekf.c"
    if ($55) {
     label = 10;
     break L1;
    }
    $56 = $10; //@line 30 "../../src/tiny_ekf/tiny_ekf.c"
    $57 = (+Math_sqrt((+$56))); //@line 30 "../../src/tiny_ekf/tiny_ekf.c"
    $58 = $5; //@line 30 "../../src/tiny_ekf/tiny_ekf.c"
    $59 = $7; //@line 30 "../../src/tiny_ekf/tiny_ekf.c"
    $60 = (($58) + ($59<<3)|0); //@line 30 "../../src/tiny_ekf/tiny_ekf.c"
    HEAPF64[$60>>3] = $57; //@line 30 "../../src/tiny_ekf/tiny_ekf.c"
   } else {
    $61 = $5; //@line 33 "../../src/tiny_ekf/tiny_ekf.c"
    $62 = $7; //@line 33 "../../src/tiny_ekf/tiny_ekf.c"
    $63 = (($61) + ($62<<3)|0); //@line 33 "../../src/tiny_ekf/tiny_ekf.c"
    $64 = +HEAPF64[$63>>3]; //@line 33 "../../src/tiny_ekf/tiny_ekf.c"
    $65 = $54 / $64; //@line 33 "../../src/tiny_ekf/tiny_ekf.c"
    $66 = $4; //@line 33 "../../src/tiny_ekf/tiny_ekf.c"
    $67 = $8; //@line 33 "../../src/tiny_ekf/tiny_ekf.c"
    $68 = $6; //@line 33 "../../src/tiny_ekf/tiny_ekf.c"
    $69 = Math_imul($67, $68)|0; //@line 33 "../../src/tiny_ekf/tiny_ekf.c"
    $70 = $7; //@line 33 "../../src/tiny_ekf/tiny_ekf.c"
    $71 = (($69) + ($70))|0; //@line 33 "../../src/tiny_ekf/tiny_ekf.c"
    $72 = (($66) + ($71<<3)|0); //@line 33 "../../src/tiny_ekf/tiny_ekf.c"
    HEAPF64[$72>>3] = $65; //@line 33 "../../src/tiny_ekf/tiny_ekf.c"
   }
   $73 = $8; //@line 21 "../../src/tiny_ekf/tiny_ekf.c"
   $74 = (($73) + 1)|0; //@line 21 "../../src/tiny_ekf/tiny_ekf.c"
   $8 = $74; //@line 21 "../../src/tiny_ekf/tiny_ekf.c"
  }
  $75 = $7; //@line 20 "../../src/tiny_ekf/tiny_ekf.c"
  $76 = (($75) + 1)|0; //@line 20 "../../src/tiny_ekf/tiny_ekf.c"
  $7 = $76; //@line 20 "../../src/tiny_ekf/tiny_ekf.c"
 }
 if ((label|0) == 10) {
  $3 = 1; //@line 28 "../../src/tiny_ekf/tiny_ekf.c"
  $77 = $3; //@line 39 "../../src/tiny_ekf/tiny_ekf.c"
  STACKTOP = sp;return ($77|0); //@line 39 "../../src/tiny_ekf/tiny_ekf.c"
 }
 else if ((label|0) == 15) {
  $3 = 0; //@line 38 "../../src/tiny_ekf/tiny_ekf.c"
  $77 = $3; //@line 39 "../../src/tiny_ekf/tiny_ekf.c"
  STACKTOP = sp;return ($77|0); //@line 39 "../../src/tiny_ekf/tiny_ekf.c"
 }
 return (0)|0;
}
function __GLOBAL__sub_I_bind_cpp() {
 var label = 0, sp = 0;
 sp = STACKTOP;
 ___cxx_global_var_init_29();
 return;
}
function ___cxx_global_var_init_29() {
 var label = 0, sp = 0;
 sp = STACKTOP;
 __ZN53EmscriptenBindingInitializer_native_and_builtin_typesC2Ev(4829); //@line 95 "/emsdk_portable/sdk/system/lib/embind/bind.cpp"
 return; //@line 95 "/emsdk_portable/sdk/system/lib/embind/bind.cpp"
}
function __ZN53EmscriptenBindingInitializer_native_and_builtin_typesC2Ev($0) {
 $0 = $0|0;
 var $1 = 0, $2 = 0, $3 = 0, $4 = 0, $5 = 0, $6 = 0, $7 = 0, label = 0, sp = 0;
 sp = STACKTOP;
 STACKTOP = STACKTOP + 16|0; if ((STACKTOP|0) >= (STACK_MAX|0)) abortStackOverflow(16|0);
 $1 = $0;
 $2 = (__ZN10emscripten8internal6TypeIDIvE3getEv()|0); //@line 98 "/emsdk_portable/sdk/system/lib/embind/bind.cpp"
 __embind_register_void(($2|0),(1202|0)); //@line 98 "/emsdk_portable/sdk/system/lib/embind/bind.cpp"
 $3 = (__ZN10emscripten8internal6TypeIDIbE3getEv()|0); //@line 100 "/emsdk_portable/sdk/system/lib/embind/bind.cpp"
 __embind_register_bool(($3|0),(1207|0),1,1,0); //@line 100 "/emsdk_portable/sdk/system/lib/embind/bind.cpp"
 __ZN12_GLOBAL__N_116register_integerIcEEvPKc(1212); //@line 102 "/emsdk_portable/sdk/system/lib/embind/bind.cpp"
 __ZN12_GLOBAL__N_116register_integerIaEEvPKc(1217); //@line 103 "/emsdk_portable/sdk/system/lib/embind/bind.cpp"
 __ZN12_GLOBAL__N_116register_integerIhEEvPKc(1229); //@line 104 "/emsdk_portable/sdk/system/lib/embind/bind.cpp"
 __ZN12_GLOBAL__N_116register_integerIsEEvPKc(1243); //@line 105 "/emsdk_portable/sdk/system/lib/embind/bind.cpp"
 __ZN12_GLOBAL__N_116register_integerItEEvPKc(1249); //@line 106 "/emsdk_portable/sdk/system/lib/embind/bind.cpp"
 __ZN12_GLOBAL__N_116register_integerIiEEvPKc(1264); //@line 107 "/emsdk_portable/sdk/system/lib/embind/bind.cpp"
 __ZN12_GLOBAL__N_116register_integerIjEEvPKc(1268); //@line 108 "/emsdk_portable/sdk/system/lib/embind/bind.cpp"
 __ZN12_GLOBAL__N_116register_integerIlEEvPKc(1281); //@line 109 "/emsdk_portable/sdk/system/lib/embind/bind.cpp"
 __ZN12_GLOBAL__N_116register_integerImEEvPKc(1286); //@line 110 "/emsdk_portable/sdk/system/lib/embind/bind.cpp"
 __ZN12_GLOBAL__N_114register_floatIfEEvPKc(1300); //@line 112 "/emsdk_portable/sdk/system/lib/embind/bind.cpp"
 __ZN12_GLOBAL__N_114register_floatIdEEvPKc(1306); //@line 113 "/emsdk_portable/sdk/system/lib/embind/bind.cpp"
 $4 = (__ZN10emscripten8internal6TypeIDINSt3__212basic_stringIcNS2_11char_traitsIcEENS2_9allocatorIcEEEEE3getEv()|0); //@line 115 "/emsdk_portable/sdk/system/lib/embind/bind.cpp"
 __embind_register_std_string(($4|0),(1313|0)); //@line 115 "/emsdk_portable/sdk/system/lib/embind/bind.cpp"
 $5 = (__ZN10emscripten8internal6TypeIDINSt3__212basic_stringIhNS2_11char_traitsIhEENS2_9allocatorIhEEEEE3getEv()|0); //@line 116 "/emsdk_portable/sdk/system/lib/embind/bind.cpp"
 __embind_register_std_string(($5|0),(1325|0)); //@line 116 "/emsdk_portable/sdk/system/lib/embind/bind.cpp"
 $6 = (__ZN10emscripten8internal6TypeIDINSt3__212basic_stringIwNS2_11char_traitsIwEENS2_9allocatorIwEEEEE3getEv()|0); //@line 117 "/emsdk_portable/sdk/system/lib/embind/bind.cpp"
 __embind_register_std_wstring(($6|0),4,(1358|0)); //@line 117 "/emsdk_portable/sdk/system/lib/embind/bind.cpp"
 $7 = (__ZN10emscripten8internal6TypeIDINS_3valEE3getEv()|0); //@line 118 "/emsdk_portable/sdk/system/lib/embind/bind.cpp"
 __embind_register_emval(($7|0),(1371|0)); //@line 118 "/emsdk_portable/sdk/system/lib/embind/bind.cpp"
 __ZN12_GLOBAL__N_120register_memory_viewIcEEvPKc(1387); //@line 126 "/emsdk_portable/sdk/system/lib/embind/bind.cpp"
 __ZN12_GLOBAL__N_120register_memory_viewIaEEvPKc(1417); //@line 127 "/emsdk_portable/sdk/system/lib/embind/bind.cpp"
 __ZN12_GLOBAL__N_120register_memory_viewIhEEvPKc(1454); //@line 128 "/emsdk_portable/sdk/system/lib/embind/bind.cpp"
 __ZN12_GLOBAL__N_120register_memory_viewIsEEvPKc(1493); //@line 130 "/emsdk_portable/sdk/system/lib/embind/bind.cpp"
 __ZN12_GLOBAL__N_120register_memory_viewItEEvPKc(1524); //@line 131 "/emsdk_portable/sdk/system/lib/embind/bind.cpp"
 __ZN12_GLOBAL__N_120register_memory_viewIiEEvPKc(1564); //@line 132 "/emsdk_portable/sdk/system/lib/embind/bind.cpp"
 __ZN12_GLOBAL__N_120register_memory_viewIjEEvPKc(1593); //@line 133 "/emsdk_portable/sdk/system/lib/embind/bind.cpp"
 __ZN12_GLOBAL__N_120register_memory_viewIlEEvPKc(1631); //@line 134 "/emsdk_portable/sdk/system/lib/embind/bind.cpp"
 __ZN12_GLOBAL__N_120register_memory_viewImEEvPKc(1661); //@line 135 "/emsdk_portable/sdk/system/lib/embind/bind.cpp"
 __ZN12_GLOBAL__N_120register_memory_viewIaEEvPKc(1700); //@line 137 "/emsdk_portable/sdk/system/lib/embind/bind.cpp"
 __ZN12_GLOBAL__N_120register_memory_viewIhEEvPKc(1732); //@line 138 "/emsdk_portable/sdk/system/lib/embind/bind.cpp"
 __ZN12_GLOBAL__N_120register_memory_viewIsEEvPKc(1765); //@line 139 "/emsdk_portable/sdk/system/lib/embind/bind.cpp"
 __ZN12_GLOBAL__N_120register_memory_viewItEEvPKc(1798); //@line 140 "/emsdk_portable/sdk/system/lib/embind/bind.cpp"
 __ZN12_GLOBAL__N_120register_memory_viewIiEEvPKc(1832); //@line 141 "/emsdk_portable/sdk/system/lib/embind/bind.cpp"
 __ZN12_GLOBAL__N_120register_memory_viewIjEEvPKc(1865); //@line 142 "/emsdk_portable/sdk/system/lib/embind/bind.cpp"
 __ZN12_GLOBAL__N_120register_memory_viewIfEEvPKc(1899); //@line 144 "/emsdk_portable/sdk/system/lib/embind/bind.cpp"
 __ZN12_GLOBAL__N_120register_memory_viewIdEEvPKc(1930); //@line 145 "/emsdk_portable/sdk/system/lib/embind/bind.cpp"
 __ZN12_GLOBAL__N_120register_memory_viewIeEEvPKc(1962); //@line 147 "/emsdk_portable/sdk/system/lib/embind/bind.cpp"
 STACKTOP = sp;return; //@line 149 "/emsdk_portable/sdk/system/lib/embind/bind.cpp"
}
function __ZN10emscripten8internal6TypeIDIvE3getEv() {
 var $0 = 0, label = 0, sp = 0;
 sp = STACKTOP;
 $0 = (__ZN10emscripten8internal11LightTypeIDIvE3getEv()|0); //@line 98 "/emsdk_portable/sdk/system/include/emscripten/wire.h"
 return ($0|0); //@line 98 "/emsdk_portable/sdk/system/include/emscripten/wire.h"
}
function __ZN10emscripten8internal6TypeIDIbE3getEv() {
 var $0 = 0, label = 0, sp = 0;
 sp = STACKTOP;
 $0 = (__ZN10emscripten8internal11LightTypeIDIbE3getEv()|0); //@line 98 "/emsdk_portable/sdk/system/include/emscripten/wire.h"
 return ($0|0); //@line 98 "/emsdk_portable/sdk/system/include/emscripten/wire.h"
}
function __ZN12_GLOBAL__N_116register_integerIcEEvPKc($0) {
 $0 = $0|0;
 var $1 = 0, $2 = 0, $3 = 0, $4 = 0, $5 = 0, label = 0, sp = 0;
 sp = STACKTOP;
 STACKTOP = STACKTOP + 16|0; if ((STACKTOP|0) >= (STACK_MAX|0)) abortStackOverflow(16|0);
 $1 = $0;
 $2 = (__ZN10emscripten8internal6TypeIDIcE3getEv()|0); //@line 51 "/emsdk_portable/sdk/system/lib/embind/bind.cpp"
 $3 = $1; //@line 51 "/emsdk_portable/sdk/system/lib/embind/bind.cpp"
 $4 = -128 << 24 >> 24; //@line 51 "/emsdk_portable/sdk/system/lib/embind/bind.cpp"
 $5 = 127 << 24 >> 24; //@line 51 "/emsdk_portable/sdk/system/lib/embind/bind.cpp"
 __embind_register_integer(($2|0),($3|0),1,($4|0),($5|0)); //@line 51 "/emsdk_portable/sdk/system/lib/embind/bind.cpp"
 STACKTOP = sp;return; //@line 52 "/emsdk_portable/sdk/system/lib/embind/bind.cpp"
}
function __ZN12_GLOBAL__N_116register_integerIaEEvPKc($0) {
 $0 = $0|0;
 var $1 = 0, $2 = 0, $3 = 0, $4 = 0, $5 = 0, label = 0, sp = 0;
 sp = STACKTOP;
 STACKTOP = STACKTOP + 16|0; if ((STACKTOP|0) >= (STACK_MAX|0)) abortStackOverflow(16|0);
 $1 = $0;
 $2 = (__ZN10emscripten8internal6TypeIDIaE3getEv()|0); //@line 51 "/emsdk_portable/sdk/system/lib/embind/bind.cpp"
 $3 = $1; //@line 51 "/emsdk_portable/sdk/system/lib/embind/bind.cpp"
 $4 = -128 << 24 >> 24; //@line 51 "/emsdk_portable/sdk/system/lib/embind/bind.cpp"
 $5 = 127 << 24 >> 24; //@line 51 "/emsdk_portable/sdk/system/lib/embind/bind.cpp"
 __embind_register_integer(($2|0),($3|0),1,($4|0),($5|0)); //@line 51 "/emsdk_portable/sdk/system/lib/embind/bind.cpp"
 STACKTOP = sp;return; //@line 52 "/emsdk_portable/sdk/system/lib/embind/bind.cpp"
}
function __ZN12_GLOBAL__N_116register_integerIhEEvPKc($0) {
 $0 = $0|0;
 var $1 = 0, $2 = 0, $3 = 0, $4 = 0, $5 = 0, label = 0, sp = 0;
 sp = STACKTOP;
 STACKTOP = STACKTOP + 16|0; if ((STACKTOP|0) >= (STACK_MAX|0)) abortStackOverflow(16|0);
 $1 = $0;
 $2 = (__ZN10emscripten8internal6TypeIDIhE3getEv()|0); //@line 51 "/emsdk_portable/sdk/system/lib/embind/bind.cpp"
 $3 = $1; //@line 51 "/emsdk_portable/sdk/system/lib/embind/bind.cpp"
 $4 = 0; //@line 51 "/emsdk_portable/sdk/system/lib/embind/bind.cpp"
 $5 = 255; //@line 51 "/emsdk_portable/sdk/system/lib/embind/bind.cpp"
 __embind_register_integer(($2|0),($3|0),1,($4|0),($5|0)); //@line 51 "/emsdk_portable/sdk/system/lib/embind/bind.cpp"
 STACKTOP = sp;return; //@line 52 "/emsdk_portable/sdk/system/lib/embind/bind.cpp"
}
function __ZN12_GLOBAL__N_116register_integerIsEEvPKc($0) {
 $0 = $0|0;
 var $1 = 0, $2 = 0, $3 = 0, $4 = 0, $5 = 0, label = 0, sp = 0;
 sp = STACKTOP;
 STACKTOP = STACKTOP + 16|0; if ((STACKTOP|0) >= (STACK_MAX|0)) abortStackOverflow(16|0);
 $1 = $0;
 $2 = (__ZN10emscripten8internal6TypeIDIsE3getEv()|0); //@line 51 "/emsdk_portable/sdk/system/lib/embind/bind.cpp"
 $3 = $1; //@line 51 "/emsdk_portable/sdk/system/lib/embind/bind.cpp"
 $4 = -32768 << 16 >> 16; //@line 51 "/emsdk_portable/sdk/system/lib/embind/bind.cpp"
 $5 = 32767 << 16 >> 16; //@line 51 "/emsdk_portable/sdk/system/lib/embind/bind.cpp"
 __embind_register_integer(($2|0),($3|0),2,($4|0),($5|0)); //@line 51 "/emsdk_portable/sdk/system/lib/embind/bind.cpp"
 STACKTOP = sp;return; //@line 52 "/emsdk_portable/sdk/system/lib/embind/bind.cpp"
}
function __ZN12_GLOBAL__N_116register_integerItEEvPKc($0) {
 $0 = $0|0;
 var $1 = 0, $2 = 0, $3 = 0, $4 = 0, $5 = 0, label = 0, sp = 0;
 sp = STACKTOP;
 STACKTOP = STACKTOP + 16|0; if ((STACKTOP|0) >= (STACK_MAX|0)) abortStackOverflow(16|0);
 $1 = $0;
 $2 = (__ZN10emscripten8internal6TypeIDItE3getEv()|0); //@line 51 "/emsdk_portable/sdk/system/lib/embind/bind.cpp"
 $3 = $1; //@line 51 "/emsdk_portable/sdk/system/lib/embind/bind.cpp"
 $4 = 0; //@line 51 "/emsdk_portable/sdk/system/lib/embind/bind.cpp"
 $5 = 65535; //@line 51 "/emsdk_portable/sdk/system/lib/embind/bind.cpp"
 __embind_register_integer(($2|0),($3|0),2,($4|0),($5|0)); //@line 51 "/emsdk_portable/sdk/system/lib/embind/bind.cpp"
 STACKTOP = sp;return; //@line 52 "/emsdk_portable/sdk/system/lib/embind/bind.cpp"
}
function __ZN12_GLOBAL__N_116register_integerIiEEvPKc($0) {
 $0 = $0|0;
 var $1 = 0, $2 = 0, $3 = 0, label = 0, sp = 0;
 sp = STACKTOP;
 STACKTOP = STACKTOP + 16|0; if ((STACKTOP|0) >= (STACK_MAX|0)) abortStackOverflow(16|0);
 $1 = $0;
 $2 = (__ZN10emscripten8internal6TypeIDIiE3getEv()|0); //@line 51 "/emsdk_portable/sdk/system/lib/embind/bind.cpp"
 $3 = $1; //@line 51 "/emsdk_portable/sdk/system/lib/embind/bind.cpp"
 __embind_register_integer(($2|0),($3|0),4,-2147483648,2147483647); //@line 51 "/emsdk_portable/sdk/system/lib/embind/bind.cpp"
 STACKTOP = sp;return; //@line 52 "/emsdk_portable/sdk/system/lib/embind/bind.cpp"
}
function __ZN12_GLOBAL__N_116register_integerIjEEvPKc($0) {
 $0 = $0|0;
 var $1 = 0, $2 = 0, $3 = 0, label = 0, sp = 0;
 sp = STACKTOP;
 STACKTOP = STACKTOP + 16|0; if ((STACKTOP|0) >= (STACK_MAX|0)) abortStackOverflow(16|0);
 $1 = $0;
 $2 = (__ZN10emscripten8internal6TypeIDIjE3getEv()|0); //@line 51 "/emsdk_portable/sdk/system/lib/embind/bind.cpp"
 $3 = $1; //@line 51 "/emsdk_portable/sdk/system/lib/embind/bind.cpp"
 __embind_register_integer(($2|0),($3|0),4,0,-1); //@line 51 "/emsdk_portable/sdk/system/lib/embind/bind.cpp"
 STACKTOP = sp;return; //@line 52 "/emsdk_portable/sdk/system/lib/embind/bind.cpp"
}
function __ZN12_GLOBAL__N_116register_integerIlEEvPKc($0) {
 $0 = $0|0;
 var $1 = 0, $2 = 0, $3 = 0, label = 0, sp = 0;
 sp = STACKTOP;
 STACKTOP = STACKTOP + 16|0; if ((STACKTOP|0) >= (STACK_MAX|0)) abortStackOverflow(16|0);
 $1 = $0;
 $2 = (__ZN10emscripten8internal6TypeIDIlE3getEv()|0); //@line 51 "/emsdk_portable/sdk/system/lib/embind/bind.cpp"
 $3 = $1; //@line 51 "/emsdk_portable/sdk/system/lib/embind/bind.cpp"
 __embind_register_integer(($2|0),($3|0),4,-2147483648,2147483647); //@line 51 "/emsdk_portable/sdk/system/lib/embind/bind.cpp"
 STACKTOP = sp;return; //@line 52 "/emsdk_portable/sdk/system/lib/embind/bind.cpp"
}
function __ZN12_GLOBAL__N_116register_integerImEEvPKc($0) {
 $0 = $0|0;
 var $1 = 0, $2 = 0, $3 = 0, label = 0, sp = 0;
 sp = STACKTOP;
 STACKTOP = STACKTOP + 16|0; if ((STACKTOP|0) >= (STACK_MAX|0)) abortStackOverflow(16|0);
 $1 = $0;
 $2 = (__ZN10emscripten8internal6TypeIDImE3getEv()|0); //@line 51 "/emsdk_portable/sdk/system/lib/embind/bind.cpp"
 $3 = $1; //@line 51 "/emsdk_portable/sdk/system/lib/embind/bind.cpp"
 __embind_register_integer(($2|0),($3|0),4,0,-1); //@line 51 "/emsdk_portable/sdk/system/lib/embind/bind.cpp"
 STACKTOP = sp;return; //@line 52 "/emsdk_portable/sdk/system/lib/embind/bind.cpp"
}
function __ZN12_GLOBAL__N_114register_floatIfEEvPKc($0) {
 $0 = $0|0;
 var $1 = 0, $2 = 0, $3 = 0, label = 0, sp = 0;
 sp = STACKTOP;
 STACKTOP = STACKTOP + 16|0; if ((STACKTOP|0) >= (STACK_MAX|0)) abortStackOverflow(16|0);
 $1 = $0;
 $2 = (__ZN10emscripten8internal6TypeIDIfE3getEv()|0); //@line 57 "/emsdk_portable/sdk/system/lib/embind/bind.cpp"
 $3 = $1; //@line 57 "/emsdk_portable/sdk/system/lib/embind/bind.cpp"
 __embind_register_float(($2|0),($3|0),4); //@line 57 "/emsdk_portable/sdk/system/lib/embind/bind.cpp"
 STACKTOP = sp;return; //@line 58 "/emsdk_portable/sdk/system/lib/embind/bind.cpp"
}
function __ZN12_GLOBAL__N_114register_floatIdEEvPKc($0) {
 $0 = $0|0;
 var $1 = 0, $2 = 0, $3 = 0, label = 0, sp = 0;
 sp = STACKTOP;
 STACKTOP = STACKTOP + 16|0; if ((STACKTOP|0) >= (STACK_MAX|0)) abortStackOverflow(16|0);
 $1 = $0;
 $2 = (__ZN10emscripten8internal6TypeIDIdE3getEv()|0); //@line 57 "/emsdk_portable/sdk/system/lib/embind/bind.cpp"
 $3 = $1; //@line 57 "/emsdk_portable/sdk/system/lib/embind/bind.cpp"
 __embind_register_float(($2|0),($3|0),8); //@line 57 "/emsdk_portable/sdk/system/lib/embind/bind.cpp"
 STACKTOP = sp;return; //@line 58 "/emsdk_portable/sdk/system/lib/embind/bind.cpp"
}
function __ZN10emscripten8internal6TypeIDINSt3__212basic_stringIcNS2_11char_traitsIcEENS2_9allocatorIcEEEEE3getEv() {
 var $0 = 0, label = 0, sp = 0;
 sp = STACKTOP;
 $0 = (__ZN10emscripten8internal11LightTypeIDINSt3__212basic_stringIcNS2_11char_traitsIcEENS2_9allocatorIcEEEEE3getEv()|0); //@line 98 "/emsdk_portable/sdk/system/include/emscripten/wire.h"
 return ($0|0); //@line 98 "/emsdk_portable/sdk/system/include/emscripten/wire.h"
}
function __ZN10emscripten8internal6TypeIDINSt3__212basic_stringIhNS2_11char_traitsIhEENS2_9allocatorIhEEEEE3getEv() {
 var $0 = 0, label = 0, sp = 0;
 sp = STACKTOP;
 $0 = (__ZN10emscripten8internal11LightTypeIDINSt3__212basic_stringIhNS2_11char_traitsIhEENS2_9allocatorIhEEEEE3getEv()|0); //@line 98 "/emsdk_portable/sdk/system/include/emscripten/wire.h"
 return ($0|0); //@line 98 "/emsdk_portable/sdk/system/include/emscripten/wire.h"
}
function __ZN10emscripten8internal6TypeIDINSt3__212basic_stringIwNS2_11char_traitsIwEENS2_9allocatorIwEEEEE3getEv() {
 var $0 = 0, label = 0, sp = 0;
 sp = STACKTOP;
 $0 = (__ZN10emscripten8internal11LightTypeIDINSt3__212basic_stringIwNS2_11char_traitsIwEENS2_9allocatorIwEEEEE3getEv()|0); //@line 98 "/emsdk_portable/sdk/system/include/emscripten/wire.h"
 return ($0|0); //@line 98 "/emsdk_portable/sdk/system/include/emscripten/wire.h"
}
function __ZN10emscripten8internal6TypeIDINS_3valEE3getEv() {
 var $0 = 0, label = 0, sp = 0;
 sp = STACKTOP;
 $0 = (__ZN10emscripten8internal11LightTypeIDINS_3valEE3getEv()|0); //@line 98 "/emsdk_portable/sdk/system/include/emscripten/wire.h"
 return ($0|0); //@line 98 "/emsdk_portable/sdk/system/include/emscripten/wire.h"
}
function __ZN12_GLOBAL__N_120register_memory_viewIcEEvPKc($0) {
 $0 = $0|0;
 var $1 = 0, $2 = 0, $3 = 0, $4 = 0, label = 0, sp = 0;
 sp = STACKTOP;
 STACKTOP = STACKTOP + 16|0; if ((STACKTOP|0) >= (STACK_MAX|0)) abortStackOverflow(16|0);
 $1 = $0;
 $2 = (__ZN10emscripten8internal6TypeIDINS_11memory_viewIcEEE3getEv()|0); //@line 91 "/emsdk_portable/sdk/system/lib/embind/bind.cpp"
 $3 = (__ZN12_GLOBAL__N_118getTypedArrayIndexIcEENS_15TypedArrayIndexEv()|0); //@line 91 "/emsdk_portable/sdk/system/lib/embind/bind.cpp"
 $4 = $1; //@line 91 "/emsdk_portable/sdk/system/lib/embind/bind.cpp"
 __embind_register_memory_view(($2|0),($3|0),($4|0)); //@line 91 "/emsdk_portable/sdk/system/lib/embind/bind.cpp"
 STACKTOP = sp;return; //@line 92 "/emsdk_portable/sdk/system/lib/embind/bind.cpp"
}
function __ZN12_GLOBAL__N_120register_memory_viewIaEEvPKc($0) {
 $0 = $0|0;
 var $1 = 0, $2 = 0, $3 = 0, $4 = 0, label = 0, sp = 0;
 sp = STACKTOP;
 STACKTOP = STACKTOP + 16|0; if ((STACKTOP|0) >= (STACK_MAX|0)) abortStackOverflow(16|0);
 $1 = $0;
 $2 = (__ZN10emscripten8internal6TypeIDINS_11memory_viewIaEEE3getEv()|0); //@line 91 "/emsdk_portable/sdk/system/lib/embind/bind.cpp"
 $3 = (__ZN12_GLOBAL__N_118getTypedArrayIndexIaEENS_15TypedArrayIndexEv()|0); //@line 91 "/emsdk_portable/sdk/system/lib/embind/bind.cpp"
 $4 = $1; //@line 91 "/emsdk_portable/sdk/system/lib/embind/bind.cpp"
 __embind_register_memory_view(($2|0),($3|0),($4|0)); //@line 91 "/emsdk_portable/sdk/system/lib/embind/bind.cpp"
 STACKTOP = sp;return; //@line 92 "/emsdk_portable/sdk/system/lib/embind/bind.cpp"
}
function __ZN12_GLOBAL__N_120register_memory_viewIhEEvPKc($0) {
 $0 = $0|0;
 var $1 = 0, $2 = 0, $3 = 0, $4 = 0, label = 0, sp = 0;
 sp = STACKTOP;
 STACKTOP = STACKTOP + 16|0; if ((STACKTOP|0) >= (STACK_MAX|0)) abortStackOverflow(16|0);
 $1 = $0;
 $2 = (__ZN10emscripten8internal6TypeIDINS_11memory_viewIhEEE3getEv()|0); //@line 91 "/emsdk_portable/sdk/system/lib/embind/bind.cpp"
 $3 = (__ZN12_GLOBAL__N_118getTypedArrayIndexIhEENS_15TypedArrayIndexEv()|0); //@line 91 "/emsdk_portable/sdk/system/lib/embind/bind.cpp"
 $4 = $1; //@line 91 "/emsdk_portable/sdk/system/lib/embind/bind.cpp"
 __embind_register_memory_view(($2|0),($3|0),($4|0)); //@line 91 "/emsdk_portable/sdk/system/lib/embind/bind.cpp"
 STACKTOP = sp;return; //@line 92 "/emsdk_portable/sdk/system/lib/embind/bind.cpp"
}
function __ZN12_GLOBAL__N_120register_memory_viewIsEEvPKc($0) {
 $0 = $0|0;
 var $1 = 0, $2 = 0, $3 = 0, $4 = 0, label = 0, sp = 0;
 sp = STACKTOP;
 STACKTOP = STACKTOP + 16|0; if ((STACKTOP|0) >= (STACK_MAX|0)) abortStackOverflow(16|0);
 $1 = $0;
 $2 = (__ZN10emscripten8internal6TypeIDINS_11memory_viewIsEEE3getEv()|0); //@line 91 "/emsdk_portable/sdk/system/lib/embind/bind.cpp"
 $3 = (__ZN12_GLOBAL__N_118getTypedArrayIndexIsEENS_15TypedArrayIndexEv()|0); //@line 91 "/emsdk_portable/sdk/system/lib/embind/bind.cpp"
 $4 = $1; //@line 91 "/emsdk_portable/sdk/system/lib/embind/bind.cpp"
 __embind_register_memory_view(($2|0),($3|0),($4|0)); //@line 91 "/emsdk_portable/sdk/system/lib/embind/bind.cpp"
 STACKTOP = sp;return; //@line 92 "/emsdk_portable/sdk/system/lib/embind/bind.cpp"
}
function __ZN12_GLOBAL__N_120register_memory_viewItEEvPKc($0) {
 $0 = $0|0;
 var $1 = 0, $2 = 0, $3 = 0, $4 = 0, label = 0, sp = 0;
 sp = STACKTOP;
 STACKTOP = STACKTOP + 16|0; if ((STACKTOP|0) >= (STACK_MAX|0)) abortStackOverflow(16|0);
 $1 = $0;
 $2 = (__ZN10emscripten8internal6TypeIDINS_11memory_viewItEEE3getEv()|0); //@line 91 "/emsdk_portable/sdk/system/lib/embind/bind.cpp"
 $3 = (__ZN12_GLOBAL__N_118getTypedArrayIndexItEENS_15TypedArrayIndexEv()|0); //@line 91 "/emsdk_portable/sdk/system/lib/embind/bind.cpp"
 $4 = $1; //@line 91 "/emsdk_portable/sdk/system/lib/embind/bind.cpp"
 __embind_register_memory_view(($2|0),($3|0),($4|0)); //@line 91 "/emsdk_portable/sdk/system/lib/embind/bind.cpp"
 STACKTOP = sp;return; //@line 92 "/emsdk_portable/sdk/system/lib/embind/bind.cpp"
}
function __ZN12_GLOBAL__N_120register_memory_viewIiEEvPKc($0) {
 $0 = $0|0;
 var $1 = 0, $2 = 0, $3 = 0, $4 = 0, label = 0, sp = 0;
 sp = STACKTOP;
 STACKTOP = STACKTOP + 16|0; if ((STACKTOP|0) >= (STACK_MAX|0)) abortStackOverflow(16|0);
 $1 = $0;
 $2 = (__ZN10emscripten8internal6TypeIDINS_11memory_viewIiEEE3getEv()|0); //@line 91 "/emsdk_portable/sdk/system/lib/embind/bind.cpp"
 $3 = (__ZN12_GLOBAL__N_118getTypedArrayIndexIiEENS_15TypedArrayIndexEv()|0); //@line 91 "/emsdk_portable/sdk/system/lib/embind/bind.cpp"
 $4 = $1; //@line 91 "/emsdk_portable/sdk/system/lib/embind/bind.cpp"
 __embind_register_memory_view(($2|0),($3|0),($4|0)); //@line 91 "/emsdk_portable/sdk/system/lib/embind/bind.cpp"
 STACKTOP = sp;return; //@line 92 "/emsdk_portable/sdk/system/lib/embind/bind.cpp"
}
function __ZN12_GLOBAL__N_120register_memory_viewIjEEvPKc($0) {
 $0 = $0|0;
 var $1 = 0, $2 = 0, $3 = 0, $4 = 0, label = 0, sp = 0;
 sp = STACKTOP;
 STACKTOP = STACKTOP + 16|0; if ((STACKTOP|0) >= (STACK_MAX|0)) abortStackOverflow(16|0);
 $1 = $0;
 $2 = (__ZN10emscripten8internal6TypeIDINS_11memory_viewIjEEE3getEv()|0); //@line 91 "/emsdk_portable/sdk/system/lib/embind/bind.cpp"
 $3 = (__ZN12_GLOBAL__N_118getTypedArrayIndexIjEENS_15TypedArrayIndexEv()|0); //@line 91 "/emsdk_portable/sdk/system/lib/embind/bind.cpp"
 $4 = $1; //@line 91 "/emsdk_portable/sdk/system/lib/embind/bind.cpp"
 __embind_register_memory_view(($2|0),($3|0),($4|0)); //@line 91 "/emsdk_portable/sdk/system/lib/embind/bind.cpp"
 STACKTOP = sp;return; //@line 92 "/emsdk_portable/sdk/system/lib/embind/bind.cpp"
}
function __ZN12_GLOBAL__N_120register_memory_viewIlEEvPKc($0) {
 $0 = $0|0;
 var $1 = 0, $2 = 0, $3 = 0, $4 = 0, label = 0, sp = 0;
 sp = STACKTOP;
 STACKTOP = STACKTOP + 16|0; if ((STACKTOP|0) >= (STACK_MAX|0)) abortStackOverflow(16|0);
 $1 = $0;
 $2 = (__ZN10emscripten8internal6TypeIDINS_11memory_viewIlEEE3getEv()|0); //@line 91 "/emsdk_portable/sdk/system/lib/embind/bind.cpp"
 $3 = (__ZN12_GLOBAL__N_118getTypedArrayIndexIlEENS_15TypedArrayIndexEv()|0); //@line 91 "/emsdk_portable/sdk/system/lib/embind/bind.cpp"
 $4 = $1; //@line 91 "/emsdk_portable/sdk/system/lib/embind/bind.cpp"
 __embind_register_memory_view(($2|0),($3|0),($4|0)); //@line 91 "/emsdk_portable/sdk/system/lib/embind/bind.cpp"
 STACKTOP = sp;return; //@line 92 "/emsdk_portable/sdk/system/lib/embind/bind.cpp"
}
function __ZN12_GLOBAL__N_120register_memory_viewImEEvPKc($0) {
 $0 = $0|0;
 var $1 = 0, $2 = 0, $3 = 0, $4 = 0, label = 0, sp = 0;
 sp = STACKTOP;
 STACKTOP = STACKTOP + 16|0; if ((STACKTOP|0) >= (STACK_MAX|0)) abortStackOverflow(16|0);
 $1 = $0;
 $2 = (__ZN10emscripten8internal6TypeIDINS_11memory_viewImEEE3getEv()|0); //@line 91 "/emsdk_portable/sdk/system/lib/embind/bind.cpp"
 $3 = (__ZN12_GLOBAL__N_118getTypedArrayIndexImEENS_15TypedArrayIndexEv()|0); //@line 91 "/emsdk_portable/sdk/system/lib/embind/bind.cpp"
 $4 = $1; //@line 91 "/emsdk_portable/sdk/system/lib/embind/bind.cpp"
 __embind_register_memory_view(($2|0),($3|0),($4|0)); //@line 91 "/emsdk_portable/sdk/system/lib/embind/bind.cpp"
 STACKTOP = sp;return; //@line 92 "/emsdk_portable/sdk/system/lib/embind/bind.cpp"
}
function __ZN12_GLOBAL__N_120register_memory_viewIfEEvPKc($0) {
 $0 = $0|0;
 var $1 = 0, $2 = 0, $3 = 0, $4 = 0, label = 0, sp = 0;
 sp = STACKTOP;
 STACKTOP = STACKTOP + 16|0; if ((STACKTOP|0) >= (STACK_MAX|0)) abortStackOverflow(16|0);
 $1 = $0;
 $2 = (__ZN10emscripten8internal6TypeIDINS_11memory_viewIfEEE3getEv()|0); //@line 91 "/emsdk_portable/sdk/system/lib/embind/bind.cpp"
 $3 = (__ZN12_GLOBAL__N_118getTypedArrayIndexIfEENS_15TypedArrayIndexEv()|0); //@line 91 "/emsdk_portable/sdk/system/lib/embind/bind.cpp"
 $4 = $1; //@line 91 "/emsdk_portable/sdk/system/lib/embind/bind.cpp"
 __embind_register_memory_view(($2|0),($3|0),($4|0)); //@line 91 "/emsdk_portable/sdk/system/lib/embind/bind.cpp"
 STACKTOP = sp;return; //@line 92 "/emsdk_portable/sdk/system/lib/embind/bind.cpp"
}
function __ZN12_GLOBAL__N_120register_memory_viewIdEEvPKc($0) {
 $0 = $0|0;
 var $1 = 0, $2 = 0, $3 = 0, $4 = 0, label = 0, sp = 0;
 sp = STACKTOP;
 STACKTOP = STACKTOP + 16|0; if ((STACKTOP|0) >= (STACK_MAX|0)) abortStackOverflow(16|0);
 $1 = $0;
 $2 = (__ZN10emscripten8internal6TypeIDINS_11memory_viewIdEEE3getEv()|0); //@line 91 "/emsdk_portable/sdk/system/lib/embind/bind.cpp"
 $3 = (__ZN12_GLOBAL__N_118getTypedArrayIndexIdEENS_15TypedArrayIndexEv()|0); //@line 91 "/emsdk_portable/sdk/system/lib/embind/bind.cpp"
 $4 = $1; //@line 91 "/emsdk_portable/sdk/system/lib/embind/bind.cpp"
 __embind_register_memory_view(($2|0),($3|0),($4|0)); //@line 91 "/emsdk_portable/sdk/system/lib/embind/bind.cpp"
 STACKTOP = sp;return; //@line 92 "/emsdk_portable/sdk/system/lib/embind/bind.cpp"
}
function __ZN12_GLOBAL__N_120register_memory_viewIeEEvPKc($0) {
 $0 = $0|0;
 var $1 = 0, $2 = 0, $3 = 0, $4 = 0, label = 0, sp = 0;
 sp = STACKTOP;
 STACKTOP = STACKTOP + 16|0; if ((STACKTOP|0) >= (STACK_MAX|0)) abortStackOverflow(16|0);
 $1 = $0;
 $2 = (__ZN10emscripten8internal6TypeIDINS_11memory_viewIeEEE3getEv()|0); //@line 91 "/emsdk_portable/sdk/system/lib/embind/bind.cpp"
 $3 = (__ZN12_GLOBAL__N_118getTypedArrayIndexIeEENS_15TypedArrayIndexEv()|0); //@line 91 "/emsdk_portable/sdk/system/lib/embind/bind.cpp"
 $4 = $1; //@line 91 "/emsdk_portable/sdk/system/lib/embind/bind.cpp"
 __embind_register_memory_view(($2|0),($3|0),($4|0)); //@line 91 "/emsdk_portable/sdk/system/lib/embind/bind.cpp"
 STACKTOP = sp;return; //@line 92 "/emsdk_portable/sdk/system/lib/embind/bind.cpp"
}
function __ZN10emscripten8internal6TypeIDINS_11memory_viewIeEEE3getEv() {
 var $0 = 0, label = 0, sp = 0;
 sp = STACKTOP;
 $0 = (__ZN10emscripten8internal11LightTypeIDINS_11memory_viewIeEEE3getEv()|0); //@line 98 "/emsdk_portable/sdk/system/include/emscripten/wire.h"
 return ($0|0); //@line 98 "/emsdk_portable/sdk/system/include/emscripten/wire.h"
}
function __ZN12_GLOBAL__N_118getTypedArrayIndexIeEENS_15TypedArrayIndexEv() {
 var label = 0, sp = 0;
 sp = STACKTOP;
 return 7; //@line 77 "/emsdk_portable/sdk/system/lib/embind/bind.cpp"
}
function __ZN10emscripten8internal11LightTypeIDINS_11memory_viewIeEEE3getEv() {
 var label = 0, sp = 0;
 sp = STACKTOP;
 return (48|0); //@line 62 "/emsdk_portable/sdk/system/include/emscripten/wire.h"
}
function __ZN10emscripten8internal6TypeIDINS_11memory_viewIdEEE3getEv() {
 var $0 = 0, label = 0, sp = 0;
 sp = STACKTOP;
 $0 = (__ZN10emscripten8internal11LightTypeIDINS_11memory_viewIdEEE3getEv()|0); //@line 98 "/emsdk_portable/sdk/system/include/emscripten/wire.h"
 return ($0|0); //@line 98 "/emsdk_portable/sdk/system/include/emscripten/wire.h"
}
function __ZN12_GLOBAL__N_118getTypedArrayIndexIdEENS_15TypedArrayIndexEv() {
 var label = 0, sp = 0;
 sp = STACKTOP;
 return 7; //@line 77 "/emsdk_portable/sdk/system/lib/embind/bind.cpp"
}
function __ZN10emscripten8internal11LightTypeIDINS_11memory_viewIdEEE3getEv() {
 var label = 0, sp = 0;
 sp = STACKTOP;
 return (56|0); //@line 62 "/emsdk_portable/sdk/system/include/emscripten/wire.h"
}
function __ZN10emscripten8internal6TypeIDINS_11memory_viewIfEEE3getEv() {
 var $0 = 0, label = 0, sp = 0;
 sp = STACKTOP;
 $0 = (__ZN10emscripten8internal11LightTypeIDINS_11memory_viewIfEEE3getEv()|0); //@line 98 "/emsdk_portable/sdk/system/include/emscripten/wire.h"
 return ($0|0); //@line 98 "/emsdk_portable/sdk/system/include/emscripten/wire.h"
}
function __ZN12_GLOBAL__N_118getTypedArrayIndexIfEENS_15TypedArrayIndexEv() {
 var label = 0, sp = 0;
 sp = STACKTOP;
 return 6; //@line 77 "/emsdk_portable/sdk/system/lib/embind/bind.cpp"
}
function __ZN10emscripten8internal11LightTypeIDINS_11memory_viewIfEEE3getEv() {
 var label = 0, sp = 0;
 sp = STACKTOP;
 return (64|0); //@line 62 "/emsdk_portable/sdk/system/include/emscripten/wire.h"
}
function __ZN10emscripten8internal6TypeIDINS_11memory_viewImEEE3getEv() {
 var $0 = 0, label = 0, sp = 0;
 sp = STACKTOP;
 $0 = (__ZN10emscripten8internal11LightTypeIDINS_11memory_viewImEEE3getEv()|0); //@line 98 "/emsdk_portable/sdk/system/include/emscripten/wire.h"
 return ($0|0); //@line 98 "/emsdk_portable/sdk/system/include/emscripten/wire.h"
}
function __ZN12_GLOBAL__N_118getTypedArrayIndexImEENS_15TypedArrayIndexEv() {
 var label = 0, sp = 0;
 sp = STACKTOP;
 return 5; //@line 77 "/emsdk_portable/sdk/system/lib/embind/bind.cpp"
}
function __ZN10emscripten8internal11LightTypeIDINS_11memory_viewImEEE3getEv() {
 var label = 0, sp = 0;
 sp = STACKTOP;
 return (72|0); //@line 62 "/emsdk_portable/sdk/system/include/emscripten/wire.h"
}
function __ZN10emscripten8internal6TypeIDINS_11memory_viewIlEEE3getEv() {
 var $0 = 0, label = 0, sp = 0;
 sp = STACKTOP;
 $0 = (__ZN10emscripten8internal11LightTypeIDINS_11memory_viewIlEEE3getEv()|0); //@line 98 "/emsdk_portable/sdk/system/include/emscripten/wire.h"
 return ($0|0); //@line 98 "/emsdk_portable/sdk/system/include/emscripten/wire.h"
}
function __ZN12_GLOBAL__N_118getTypedArrayIndexIlEENS_15TypedArrayIndexEv() {
 var label = 0, sp = 0;
 sp = STACKTOP;
 return 4; //@line 77 "/emsdk_portable/sdk/system/lib/embind/bind.cpp"
}
function __ZN10emscripten8internal11LightTypeIDINS_11memory_viewIlEEE3getEv() {
 var label = 0, sp = 0;
 sp = STACKTOP;
 return (80|0); //@line 62 "/emsdk_portable/sdk/system/include/emscripten/wire.h"
}
function __ZN10emscripten8internal6TypeIDINS_11memory_viewIjEEE3getEv() {
 var $0 = 0, label = 0, sp = 0;
 sp = STACKTOP;
 $0 = (__ZN10emscripten8internal11LightTypeIDINS_11memory_viewIjEEE3getEv()|0); //@line 98 "/emsdk_portable/sdk/system/include/emscripten/wire.h"
 return ($0|0); //@line 98 "/emsdk_portable/sdk/system/include/emscripten/wire.h"
}
function __ZN12_GLOBAL__N_118getTypedArrayIndexIjEENS_15TypedArrayIndexEv() {
 var label = 0, sp = 0;
 sp = STACKTOP;
 return 5; //@line 77 "/emsdk_portable/sdk/system/lib/embind/bind.cpp"
}
function __ZN10emscripten8internal11LightTypeIDINS_11memory_viewIjEEE3getEv() {
 var label = 0, sp = 0;
 sp = STACKTOP;
 return (88|0); //@line 62 "/emsdk_portable/sdk/system/include/emscripten/wire.h"
}
function __ZN10emscripten8internal6TypeIDINS_11memory_viewIiEEE3getEv() {
 var $0 = 0, label = 0, sp = 0;
 sp = STACKTOP;
 $0 = (__ZN10emscripten8internal11LightTypeIDINS_11memory_viewIiEEE3getEv()|0); //@line 98 "/emsdk_portable/sdk/system/include/emscripten/wire.h"
 return ($0|0); //@line 98 "/emsdk_portable/sdk/system/include/emscripten/wire.h"
}
function __ZN12_GLOBAL__N_118getTypedArrayIndexIiEENS_15TypedArrayIndexEv() {
 var label = 0, sp = 0;
 sp = STACKTOP;
 return 4; //@line 77 "/emsdk_portable/sdk/system/lib/embind/bind.cpp"
}
function __ZN10emscripten8internal11LightTypeIDINS_11memory_viewIiEEE3getEv() {
 var label = 0, sp = 0;
 sp = STACKTOP;
 return (96|0); //@line 62 "/emsdk_portable/sdk/system/include/emscripten/wire.h"
}
function __ZN10emscripten8internal6TypeIDINS_11memory_viewItEEE3getEv() {
 var $0 = 0, label = 0, sp = 0;
 sp = STACKTOP;
 $0 = (__ZN10emscripten8internal11LightTypeIDINS_11memory_viewItEEE3getEv()|0); //@line 98 "/emsdk_portable/sdk/system/include/emscripten/wire.h"
 return ($0|0); //@line 98 "/emsdk_portable/sdk/system/include/emscripten/wire.h"
}
function __ZN12_GLOBAL__N_118getTypedArrayIndexItEENS_15TypedArrayIndexEv() {
 var label = 0, sp = 0;
 sp = STACKTOP;
 return 3; //@line 77 "/emsdk_portable/sdk/system/lib/embind/bind.cpp"
}
function __ZN10emscripten8internal11LightTypeIDINS_11memory_viewItEEE3getEv() {
 var label = 0, sp = 0;
 sp = STACKTOP;
 return (104|0); //@line 62 "/emsdk_portable/sdk/system/include/emscripten/wire.h"
}
function __ZN10emscripten8internal6TypeIDINS_11memory_viewIsEEE3getEv() {
 var $0 = 0, label = 0, sp = 0;
 sp = STACKTOP;
 $0 = (__ZN10emscripten8internal11LightTypeIDINS_11memory_viewIsEEE3getEv()|0); //@line 98 "/emsdk_portable/sdk/system/include/emscripten/wire.h"
 return ($0|0); //@line 98 "/emsdk_portable/sdk/system/include/emscripten/wire.h"
}
function __ZN12_GLOBAL__N_118getTypedArrayIndexIsEENS_15TypedArrayIndexEv() {
 var label = 0, sp = 0;
 sp = STACKTOP;
 return 2; //@line 77 "/emsdk_portable/sdk/system/lib/embind/bind.cpp"
}
function __ZN10emscripten8internal11LightTypeIDINS_11memory_viewIsEEE3getEv() {
 var label = 0, sp = 0;
 sp = STACKTOP;
 return (112|0); //@line 62 "/emsdk_portable/sdk/system/include/emscripten/wire.h"
}
function __ZN10emscripten8internal6TypeIDINS_11memory_viewIhEEE3getEv() {
 var $0 = 0, label = 0, sp = 0;
 sp = STACKTOP;
 $0 = (__ZN10emscripten8internal11LightTypeIDINS_11memory_viewIhEEE3getEv()|0); //@line 98 "/emsdk_portable/sdk/system/include/emscripten/wire.h"
 return ($0|0); //@line 98 "/emsdk_portable/sdk/system/include/emscripten/wire.h"
}
function __ZN12_GLOBAL__N_118getTypedArrayIndexIhEENS_15TypedArrayIndexEv() {
 var label = 0, sp = 0;
 sp = STACKTOP;
 return 1; //@line 77 "/emsdk_portable/sdk/system/lib/embind/bind.cpp"
}
function __ZN10emscripten8internal11LightTypeIDINS_11memory_viewIhEEE3getEv() {
 var label = 0, sp = 0;
 sp = STACKTOP;
 return (120|0); //@line 62 "/emsdk_portable/sdk/system/include/emscripten/wire.h"
}
function __ZN10emscripten8internal6TypeIDINS_11memory_viewIaEEE3getEv() {
 var $0 = 0, label = 0, sp = 0;
 sp = STACKTOP;
 $0 = (__ZN10emscripten8internal11LightTypeIDINS_11memory_viewIaEEE3getEv()|0); //@line 98 "/emsdk_portable/sdk/system/include/emscripten/wire.h"
 return ($0|0); //@line 98 "/emsdk_portable/sdk/system/include/emscripten/wire.h"
}
function __ZN12_GLOBAL__N_118getTypedArrayIndexIaEENS_15TypedArrayIndexEv() {
 var label = 0, sp = 0;
 sp = STACKTOP;
 return 0; //@line 77 "/emsdk_portable/sdk/system/lib/embind/bind.cpp"
}
function __ZN10emscripten8internal11LightTypeIDINS_11memory_viewIaEEE3getEv() {
 var label = 0, sp = 0;
 sp = STACKTOP;
 return (128|0); //@line 62 "/emsdk_portable/sdk/system/include/emscripten/wire.h"
}
function __ZN10emscripten8internal6TypeIDINS_11memory_viewIcEEE3getEv() {
 var $0 = 0, label = 0, sp = 0;
 sp = STACKTOP;
 $0 = (__ZN10emscripten8internal11LightTypeIDINS_11memory_viewIcEEE3getEv()|0); //@line 98 "/emsdk_portable/sdk/system/include/emscripten/wire.h"
 return ($0|0); //@line 98 "/emsdk_portable/sdk/system/include/emscripten/wire.h"
}
function __ZN12_GLOBAL__N_118getTypedArrayIndexIcEENS_15TypedArrayIndexEv() {
 var label = 0, sp = 0;
 sp = STACKTOP;
 return 0; //@line 77 "/emsdk_portable/sdk/system/lib/embind/bind.cpp"
}
function __ZN10emscripten8internal11LightTypeIDINS_11memory_viewIcEEE3getEv() {
 var label = 0, sp = 0;
 sp = STACKTOP;
 return (136|0); //@line 62 "/emsdk_portable/sdk/system/include/emscripten/wire.h"
}
function __ZN10emscripten8internal11LightTypeIDINS_3valEE3getEv() {
 var label = 0, sp = 0;
 sp = STACKTOP;
 return (144|0); //@line 62 "/emsdk_portable/sdk/system/include/emscripten/wire.h"
}
function __ZN10emscripten8internal11LightTypeIDINSt3__212basic_stringIwNS2_11char_traitsIwEENS2_9allocatorIwEEEEE3getEv() {
 var label = 0, sp = 0;
 sp = STACKTOP;
 return (152|0); //@line 62 "/emsdk_portable/sdk/system/include/emscripten/wire.h"
}
function __ZN10emscripten8internal11LightTypeIDINSt3__212basic_stringIhNS2_11char_traitsIhEENS2_9allocatorIhEEEEE3getEv() {
 var label = 0, sp = 0;
 sp = STACKTOP;
 return (184|0); //@line 62 "/emsdk_portable/sdk/system/include/emscripten/wire.h"
}
function __ZN10emscripten8internal11LightTypeIDINSt3__212basic_stringIcNS2_11char_traitsIcEENS2_9allocatorIcEEEEE3getEv() {
 var label = 0, sp = 0;
 sp = STACKTOP;
 return (208|0); //@line 62 "/emsdk_portable/sdk/system/include/emscripten/wire.h"
}
function __ZN10emscripten8internal6TypeIDIdE3getEv() {
 var $0 = 0, label = 0, sp = 0;
 sp = STACKTOP;
 $0 = (__ZN10emscripten8internal11LightTypeIDIdE3getEv()|0); //@line 98 "/emsdk_portable/sdk/system/include/emscripten/wire.h"
 return ($0|0); //@line 98 "/emsdk_portable/sdk/system/include/emscripten/wire.h"
}
function __ZN10emscripten8internal11LightTypeIDIdE3getEv() {
 var label = 0, sp = 0;
 sp = STACKTOP;
 return (440|0); //@line 62 "/emsdk_portable/sdk/system/include/emscripten/wire.h"
}
function __ZN10emscripten8internal6TypeIDIfE3getEv() {
 var $0 = 0, label = 0, sp = 0;
 sp = STACKTOP;
 $0 = (__ZN10emscripten8internal11LightTypeIDIfE3getEv()|0); //@line 98 "/emsdk_portable/sdk/system/include/emscripten/wire.h"
 return ($0|0); //@line 98 "/emsdk_portable/sdk/system/include/emscripten/wire.h"
}
function __ZN10emscripten8internal11LightTypeIDIfE3getEv() {
 var label = 0, sp = 0;
 sp = STACKTOP;
 return (432|0); //@line 62 "/emsdk_portable/sdk/system/include/emscripten/wire.h"
}
function __ZN10emscripten8internal6TypeIDImE3getEv() {
 var $0 = 0, label = 0, sp = 0;
 sp = STACKTOP;
 $0 = (__ZN10emscripten8internal11LightTypeIDImE3getEv()|0); //@line 98 "/emsdk_portable/sdk/system/include/emscripten/wire.h"
 return ($0|0); //@line 98 "/emsdk_portable/sdk/system/include/emscripten/wire.h"
}
function __ZN10emscripten8internal11LightTypeIDImE3getEv() {
 var label = 0, sp = 0;
 sp = STACKTOP;
 return (424|0); //@line 62 "/emsdk_portable/sdk/system/include/emscripten/wire.h"
}
function __ZN10emscripten8internal6TypeIDIlE3getEv() {
 var $0 = 0, label = 0, sp = 0;
 sp = STACKTOP;
 $0 = (__ZN10emscripten8internal11LightTypeIDIlE3getEv()|0); //@line 98 "/emsdk_portable/sdk/system/include/emscripten/wire.h"
 return ($0|0); //@line 98 "/emsdk_portable/sdk/system/include/emscripten/wire.h"
}
function __ZN10emscripten8internal11LightTypeIDIlE3getEv() {
 var label = 0, sp = 0;
 sp = STACKTOP;
 return (416|0); //@line 62 "/emsdk_portable/sdk/system/include/emscripten/wire.h"
}
function __ZN10emscripten8internal6TypeIDIjE3getEv() {
 var $0 = 0, label = 0, sp = 0;
 sp = STACKTOP;
 $0 = (__ZN10emscripten8internal11LightTypeIDIjE3getEv()|0); //@line 98 "/emsdk_portable/sdk/system/include/emscripten/wire.h"
 return ($0|0); //@line 98 "/emsdk_portable/sdk/system/include/emscripten/wire.h"
}
function __ZN10emscripten8internal11LightTypeIDIjE3getEv() {
 var label = 0, sp = 0;
 sp = STACKTOP;
 return (408|0); //@line 62 "/emsdk_portable/sdk/system/include/emscripten/wire.h"
}
function __ZN10emscripten8internal6TypeIDIiE3getEv() {
 var $0 = 0, label = 0, sp = 0;
 sp = STACKTOP;
 $0 = (__ZN10emscripten8internal11LightTypeIDIiE3getEv()|0); //@line 98 "/emsdk_portable/sdk/system/include/emscripten/wire.h"
 return ($0|0); //@line 98 "/emsdk_portable/sdk/system/include/emscripten/wire.h"
}
function __ZN10emscripten8internal11LightTypeIDIiE3getEv() {
 var label = 0, sp = 0;
 sp = STACKTOP;
 return (400|0); //@line 62 "/emsdk_portable/sdk/system/include/emscripten/wire.h"
}
function __ZN10emscripten8internal6TypeIDItE3getEv() {
 var $0 = 0, label = 0, sp = 0;
 sp = STACKTOP;
 $0 = (__ZN10emscripten8internal11LightTypeIDItE3getEv()|0); //@line 98 "/emsdk_portable/sdk/system/include/emscripten/wire.h"
 return ($0|0); //@line 98 "/emsdk_portable/sdk/system/include/emscripten/wire.h"
}
function __ZN10emscripten8internal11LightTypeIDItE3getEv() {
 var label = 0, sp = 0;
 sp = STACKTOP;
 return (392|0); //@line 62 "/emsdk_portable/sdk/system/include/emscripten/wire.h"
}
function __ZN10emscripten8internal6TypeIDIsE3getEv() {
 var $0 = 0, label = 0, sp = 0;
 sp = STACKTOP;
 $0 = (__ZN10emscripten8internal11LightTypeIDIsE3getEv()|0); //@line 98 "/emsdk_portable/sdk/system/include/emscripten/wire.h"
 return ($0|0); //@line 98 "/emsdk_portable/sdk/system/include/emscripten/wire.h"
}
function __ZN10emscripten8internal11LightTypeIDIsE3getEv() {
 var label = 0, sp = 0;
 sp = STACKTOP;
 return (384|0); //@line 62 "/emsdk_portable/sdk/system/include/emscripten/wire.h"
}
function __ZN10emscripten8internal6TypeIDIhE3getEv() {
 var $0 = 0, label = 0, sp = 0;
 sp = STACKTOP;
 $0 = (__ZN10emscripten8internal11LightTypeIDIhE3getEv()|0); //@line 98 "/emsdk_portable/sdk/system/include/emscripten/wire.h"
 return ($0|0); //@line 98 "/emsdk_portable/sdk/system/include/emscripten/wire.h"
}
function __ZN10emscripten8internal11LightTypeIDIhE3getEv() {
 var label = 0, sp = 0;
 sp = STACKTOP;
 return (368|0); //@line 62 "/emsdk_portable/sdk/system/include/emscripten/wire.h"
}
function __ZN10emscripten8internal6TypeIDIaE3getEv() {
 var $0 = 0, label = 0, sp = 0;
 sp = STACKTOP;
 $0 = (__ZN10emscripten8internal11LightTypeIDIaE3getEv()|0); //@line 98 "/emsdk_portable/sdk/system/include/emscripten/wire.h"
 return ($0|0); //@line 98 "/emsdk_portable/sdk/system/include/emscripten/wire.h"
}
function __ZN10emscripten8internal11LightTypeIDIaE3getEv() {
 var label = 0, sp = 0;
 sp = STACKTOP;
 return (376|0); //@line 62 "/emsdk_portable/sdk/system/include/emscripten/wire.h"
}
function __ZN10emscripten8internal6TypeIDIcE3getEv() {
 var $0 = 0, label = 0, sp = 0;
 sp = STACKTOP;
 $0 = (__ZN10emscripten8internal11LightTypeIDIcE3getEv()|0); //@line 98 "/emsdk_portable/sdk/system/include/emscripten/wire.h"
 return ($0|0); //@line 98 "/emsdk_portable/sdk/system/include/emscripten/wire.h"
}
function __ZN10emscripten8internal11LightTypeIDIcE3getEv() {
 var label = 0, sp = 0;
 sp = STACKTOP;
 return (360|0); //@line 62 "/emsdk_portable/sdk/system/include/emscripten/wire.h"
}
function __ZN10emscripten8internal11LightTypeIDIbE3getEv() {
 var label = 0, sp = 0;
 sp = STACKTOP;
 return (352|0); //@line 62 "/emsdk_portable/sdk/system/include/emscripten/wire.h"
}
function __ZN10emscripten8internal11LightTypeIDIvE3getEv() {
 var label = 0, sp = 0;
 sp = STACKTOP;
 return (336|0); //@line 62 "/emsdk_portable/sdk/system/include/emscripten/wire.h"
}
function ___getTypeName($0) {
 $0 = $0|0;
 var $1 = 0, $2 = 0, $3 = 0, $4 = 0, $5 = 0, $6 = 0, $7 = 0, label = 0, sp = 0;
 sp = STACKTOP;
 STACKTOP = STACKTOP + 16|0; if ((STACKTOP|0) >= (STACK_MAX|0)) abortStackOverflow(16|0);
 $2 = $0;
 $3 = $2; //@line 37 "/emsdk_portable/sdk/system/lib/embind/bind.cpp"
 $1 = $3;
 $4 = $1;
 $5 = ((($4)) + 4|0); //@line 181 "/emsdk_portable/sdk/system/include/libcxx/typeinfo"
 $6 = HEAP32[$5>>2]|0; //@line 181 "/emsdk_portable/sdk/system/include/libcxx/typeinfo"
 $7 = (___strdup($6)|0); //@line 37 "/emsdk_portable/sdk/system/lib/embind/bind.cpp"
 STACKTOP = sp;return ($7|0); //@line 37 "/emsdk_portable/sdk/system/lib/embind/bind.cpp"
}
function _malloc($0) {
 $0 = $0|0;
 var $$0 = 0, $$0$i$i = 0, $$0$i$i$i = 0, $$0$i16$i = 0, $$0187$i = 0, $$0189$i = 0, $$0190$i = 0, $$0191$i = 0, $$0197 = 0, $$0199 = 0, $$02065$i$i = 0, $$0207$lcssa$i$i = 0, $$02074$i$i = 0, $$0211$i$i = 0, $$0212$i$i = 0, $$024372$i = 0, $$0286$i$i = 0, $$028711$i$i = 0, $$0288$lcssa$i$i = 0, $$028810$i$i = 0;
 var $$0294$i$i = 0, $$0295$i$i = 0, $$0340$i = 0, $$034217$i = 0, $$0343$lcssa$i = 0, $$034316$i = 0, $$0345$i = 0, $$0351$i = 0, $$0357$i = 0, $$0358$i = 0, $$0360$i = 0, $$0361$i = 0, $$0367$i = 0, $$1194$i = 0, $$1194$i$be = 0, $$1194$i$ph = 0, $$1196$i = 0, $$1196$i$be = 0, $$1196$i$ph = 0, $$124471$i = 0;
 var $$1290$i$i = 0, $$1290$i$i$be = 0, $$1290$i$i$ph = 0, $$1292$i$i = 0, $$1292$i$i$be = 0, $$1292$i$i$ph = 0, $$1341$i = 0, $$1346$i = 0, $$1362$i = 0, $$1369$i = 0, $$1369$i$be = 0, $$1369$i$ph = 0, $$1373$i = 0, $$1373$i$be = 0, $$1373$i$ph = 0, $$2234243136$i = 0, $$2247$ph$i = 0, $$2253$ph$i = 0, $$2353$i = 0, $$3$i = 0;
 var $$3$i$i = 0, $$3$i203 = 0, $$3$i203218 = 0, $$3348$i = 0, $$3371$i = 0, $$4$lcssa$i = 0, $$420$i = 0, $$420$i$ph = 0, $$4236$i = 0, $$4349$lcssa$i = 0, $$434919$i = 0, $$434919$i$ph = 0, $$4355$i = 0, $$535618$i = 0, $$535618$i$ph = 0, $$723947$i = 0, $$748$i = 0, $$pre = 0, $$pre$i = 0, $$pre$i$i = 0;
 var $$pre$i17$i = 0, $$pre$i208 = 0, $$pre$i210 = 0, $$pre$phi$i$iZ2D = 0, $$pre$phi$i18$iZ2D = 0, $$pre$phi$i209Z2D = 0, $$pre$phi$iZ2D = 0, $$pre$phi17$i$iZ2D = 0, $$pre$phiZ2D = 0, $$pre16$i$i = 0, $$sink = 0, $$sink325 = 0, $$sink326 = 0, $1 = 0, $10 = 0, $100 = 0, $1000 = 0, $1001 = 0, $1002 = 0, $1003 = 0;
 var $1004 = 0, $1005 = 0, $1006 = 0, $1007 = 0, $1008 = 0, $1009 = 0, $101 = 0, $1010 = 0, $1011 = 0, $1012 = 0, $1013 = 0, $1014 = 0, $1015 = 0, $1016 = 0, $1017 = 0, $1018 = 0, $1019 = 0, $102 = 0, $1020 = 0, $1021 = 0;
 var $1022 = 0, $1023 = 0, $1024 = 0, $1025 = 0, $1026 = 0, $1027 = 0, $1028 = 0, $1029 = 0, $103 = 0, $1030 = 0, $1031 = 0, $1032 = 0, $1033 = 0, $1034 = 0, $1035 = 0, $1036 = 0, $1037 = 0, $1038 = 0, $1039 = 0, $104 = 0;
 var $1040 = 0, $1041 = 0, $1042 = 0, $1043 = 0, $1044 = 0, $1045 = 0, $1046 = 0, $1047 = 0, $1048 = 0, $1049 = 0, $105 = 0, $1050 = 0, $1051 = 0, $1052 = 0, $1053 = 0, $1054 = 0, $1055 = 0, $1056 = 0, $1057 = 0, $1058 = 0;
 var $1059 = 0, $106 = 0, $1060 = 0, $1061 = 0, $1062 = 0, $1063 = 0, $1064 = 0, $1065 = 0, $1066 = 0, $1067 = 0, $1068 = 0, $1069 = 0, $107 = 0, $1070 = 0, $108 = 0, $109 = 0, $11 = 0, $110 = 0, $111 = 0, $112 = 0;
 var $113 = 0, $114 = 0, $115 = 0, $116 = 0, $117 = 0, $118 = 0, $119 = 0, $12 = 0, $120 = 0, $121 = 0, $122 = 0, $123 = 0, $124 = 0, $125 = 0, $126 = 0, $127 = 0, $128 = 0, $129 = 0, $13 = 0, $130 = 0;
 var $131 = 0, $132 = 0, $133 = 0, $134 = 0, $135 = 0, $136 = 0, $137 = 0, $138 = 0, $139 = 0, $14 = 0, $140 = 0, $141 = 0, $142 = 0, $143 = 0, $144 = 0, $145 = 0, $146 = 0, $147 = 0, $148 = 0, $149 = 0;
 var $15 = 0, $150 = 0, $151 = 0, $152 = 0, $153 = 0, $154 = 0, $155 = 0, $156 = 0, $157 = 0, $158 = 0, $159 = 0, $16 = 0, $160 = 0, $161 = 0, $162 = 0, $163 = 0, $164 = 0, $165 = 0, $166 = 0, $167 = 0;
 var $168 = 0, $169 = 0, $17 = 0, $170 = 0, $171 = 0, $172 = 0, $173 = 0, $174 = 0, $175 = 0, $176 = 0, $177 = 0, $178 = 0, $179 = 0, $18 = 0, $180 = 0, $181 = 0, $182 = 0, $183 = 0, $184 = 0, $185 = 0;
 var $186 = 0, $187 = 0, $188 = 0, $189 = 0, $19 = 0, $190 = 0, $191 = 0, $192 = 0, $193 = 0, $194 = 0, $195 = 0, $196 = 0, $197 = 0, $198 = 0, $199 = 0, $2 = 0, $20 = 0, $200 = 0, $201 = 0, $202 = 0;
 var $203 = 0, $204 = 0, $205 = 0, $206 = 0, $207 = 0, $208 = 0, $209 = 0, $21 = 0, $210 = 0, $211 = 0, $212 = 0, $213 = 0, $214 = 0, $215 = 0, $216 = 0, $217 = 0, $218 = 0, $219 = 0, $22 = 0, $220 = 0;
 var $221 = 0, $222 = 0, $223 = 0, $224 = 0, $225 = 0, $226 = 0, $227 = 0, $228 = 0, $229 = 0, $23 = 0, $230 = 0, $231 = 0, $232 = 0, $233 = 0, $234 = 0, $235 = 0, $236 = 0, $237 = 0, $238 = 0, $239 = 0;
 var $24 = 0, $240 = 0, $241 = 0, $242 = 0, $243 = 0, $244 = 0, $245 = 0, $246 = 0, $247 = 0, $248 = 0, $249 = 0, $25 = 0, $250 = 0, $251 = 0, $252 = 0, $253 = 0, $254 = 0, $255 = 0, $256 = 0, $257 = 0;
 var $258 = 0, $259 = 0, $26 = 0, $260 = 0, $261 = 0, $262 = 0, $263 = 0, $264 = 0, $265 = 0, $266 = 0, $267 = 0, $268 = 0, $269 = 0, $27 = 0, $270 = 0, $271 = 0, $272 = 0, $273 = 0, $274 = 0, $275 = 0;
 var $276 = 0, $277 = 0, $278 = 0, $279 = 0, $28 = 0, $280 = 0, $281 = 0, $282 = 0, $283 = 0, $284 = 0, $285 = 0, $286 = 0, $287 = 0, $288 = 0, $289 = 0, $29 = 0, $290 = 0, $291 = 0, $292 = 0, $293 = 0;
 var $294 = 0, $295 = 0, $296 = 0, $297 = 0, $298 = 0, $299 = 0, $3 = 0, $30 = 0, $300 = 0, $301 = 0, $302 = 0, $303 = 0, $304 = 0, $305 = 0, $306 = 0, $307 = 0, $308 = 0, $309 = 0, $31 = 0, $310 = 0;
 var $311 = 0, $312 = 0, $313 = 0, $314 = 0, $315 = 0, $316 = 0, $317 = 0, $318 = 0, $319 = 0, $32 = 0, $320 = 0, $321 = 0, $322 = 0, $323 = 0, $324 = 0, $325 = 0, $326 = 0, $327 = 0, $328 = 0, $329 = 0;
 var $33 = 0, $330 = 0, $331 = 0, $332 = 0, $333 = 0, $334 = 0, $335 = 0, $336 = 0, $337 = 0, $338 = 0, $339 = 0, $34 = 0, $340 = 0, $341 = 0, $342 = 0, $343 = 0, $344 = 0, $345 = 0, $346 = 0, $347 = 0;
 var $348 = 0, $349 = 0, $35 = 0, $350 = 0, $351 = 0, $352 = 0, $353 = 0, $354 = 0, $355 = 0, $356 = 0, $357 = 0, $358 = 0, $359 = 0, $36 = 0, $360 = 0, $361 = 0, $362 = 0, $363 = 0, $364 = 0, $365 = 0;
 var $366 = 0, $367 = 0, $368 = 0, $369 = 0, $37 = 0, $370 = 0, $371 = 0, $372 = 0, $373 = 0, $374 = 0, $375 = 0, $376 = 0, $377 = 0, $378 = 0, $379 = 0, $38 = 0, $380 = 0, $381 = 0, $382 = 0, $383 = 0;
 var $384 = 0, $385 = 0, $386 = 0, $387 = 0, $388 = 0, $389 = 0, $39 = 0, $390 = 0, $391 = 0, $392 = 0, $393 = 0, $394 = 0, $395 = 0, $396 = 0, $397 = 0, $398 = 0, $399 = 0, $4 = 0, $40 = 0, $400 = 0;
 var $401 = 0, $402 = 0, $403 = 0, $404 = 0, $405 = 0, $406 = 0, $407 = 0, $408 = 0, $409 = 0, $41 = 0, $410 = 0, $411 = 0, $412 = 0, $413 = 0, $414 = 0, $415 = 0, $416 = 0, $417 = 0, $418 = 0, $419 = 0;
 var $42 = 0, $420 = 0, $421 = 0, $422 = 0, $423 = 0, $424 = 0, $425 = 0, $426 = 0, $427 = 0, $428 = 0, $429 = 0, $43 = 0, $430 = 0, $431 = 0, $432 = 0, $433 = 0, $434 = 0, $435 = 0, $436 = 0, $437 = 0;
 var $438 = 0, $439 = 0, $44 = 0, $440 = 0, $441 = 0, $442 = 0, $443 = 0, $444 = 0, $445 = 0, $446 = 0, $447 = 0, $448 = 0, $449 = 0, $45 = 0, $450 = 0, $451 = 0, $452 = 0, $453 = 0, $454 = 0, $455 = 0;
 var $456 = 0, $457 = 0, $458 = 0, $459 = 0, $46 = 0, $460 = 0, $461 = 0, $462 = 0, $463 = 0, $464 = 0, $465 = 0, $466 = 0, $467 = 0, $468 = 0, $469 = 0, $47 = 0, $470 = 0, $471 = 0, $472 = 0, $473 = 0;
 var $474 = 0, $475 = 0, $476 = 0, $477 = 0, $478 = 0, $479 = 0, $48 = 0, $480 = 0, $481 = 0, $482 = 0, $483 = 0, $484 = 0, $485 = 0, $486 = 0, $487 = 0, $488 = 0, $489 = 0, $49 = 0, $490 = 0, $491 = 0;
 var $492 = 0, $493 = 0, $494 = 0, $495 = 0, $496 = 0, $497 = 0, $498 = 0, $499 = 0, $5 = 0, $50 = 0, $500 = 0, $501 = 0, $502 = 0, $503 = 0, $504 = 0, $505 = 0, $506 = 0, $507 = 0, $508 = 0, $509 = 0;
 var $51 = 0, $510 = 0, $511 = 0, $512 = 0, $513 = 0, $514 = 0, $515 = 0, $516 = 0, $517 = 0, $518 = 0, $519 = 0, $52 = 0, $520 = 0, $521 = 0, $522 = 0, $523 = 0, $524 = 0, $525 = 0, $526 = 0, $527 = 0;
 var $528 = 0, $529 = 0, $53 = 0, $530 = 0, $531 = 0, $532 = 0, $533 = 0, $534 = 0, $535 = 0, $536 = 0, $537 = 0, $538 = 0, $539 = 0, $54 = 0, $540 = 0, $541 = 0, $542 = 0, $543 = 0, $544 = 0, $545 = 0;
 var $546 = 0, $547 = 0, $548 = 0, $549 = 0, $55 = 0, $550 = 0, $551 = 0, $552 = 0, $553 = 0, $554 = 0, $555 = 0, $556 = 0, $557 = 0, $558 = 0, $559 = 0, $56 = 0, $560 = 0, $561 = 0, $562 = 0, $563 = 0;
 var $564 = 0, $565 = 0, $566 = 0, $567 = 0, $568 = 0, $569 = 0, $57 = 0, $570 = 0, $571 = 0, $572 = 0, $573 = 0, $574 = 0, $575 = 0, $576 = 0, $577 = 0, $578 = 0, $579 = 0, $58 = 0, $580 = 0, $581 = 0;
 var $582 = 0, $583 = 0, $584 = 0, $585 = 0, $586 = 0, $587 = 0, $588 = 0, $589 = 0, $59 = 0, $590 = 0, $591 = 0, $592 = 0, $593 = 0, $594 = 0, $595 = 0, $596 = 0, $597 = 0, $598 = 0, $599 = 0, $6 = 0;
 var $60 = 0, $600 = 0, $601 = 0, $602 = 0, $603 = 0, $604 = 0, $605 = 0, $606 = 0, $607 = 0, $608 = 0, $609 = 0, $61 = 0, $610 = 0, $611 = 0, $612 = 0, $613 = 0, $614 = 0, $615 = 0, $616 = 0, $617 = 0;
 var $618 = 0, $619 = 0, $62 = 0, $620 = 0, $621 = 0, $622 = 0, $623 = 0, $624 = 0, $625 = 0, $626 = 0, $627 = 0, $628 = 0, $629 = 0, $63 = 0, $630 = 0, $631 = 0, $632 = 0, $633 = 0, $634 = 0, $635 = 0;
 var $636 = 0, $637 = 0, $638 = 0, $639 = 0, $64 = 0, $640 = 0, $641 = 0, $642 = 0, $643 = 0, $644 = 0, $645 = 0, $646 = 0, $647 = 0, $648 = 0, $649 = 0, $65 = 0, $650 = 0, $651 = 0, $652 = 0, $653 = 0;
 var $654 = 0, $655 = 0, $656 = 0, $657 = 0, $658 = 0, $659 = 0, $66 = 0, $660 = 0, $661 = 0, $662 = 0, $663 = 0, $664 = 0, $665 = 0, $666 = 0, $667 = 0, $668 = 0, $669 = 0, $67 = 0, $670 = 0, $671 = 0;
 var $672 = 0, $673 = 0, $674 = 0, $675 = 0, $676 = 0, $677 = 0, $678 = 0, $679 = 0, $68 = 0, $680 = 0, $681 = 0, $682 = 0, $683 = 0, $684 = 0, $685 = 0, $686 = 0, $687 = 0, $688 = 0, $689 = 0, $69 = 0;
 var $690 = 0, $691 = 0, $692 = 0, $693 = 0, $694 = 0, $695 = 0, $696 = 0, $697 = 0, $698 = 0, $699 = 0, $7 = 0, $70 = 0, $700 = 0, $701 = 0, $702 = 0, $703 = 0, $704 = 0, $705 = 0, $706 = 0, $707 = 0;
 var $708 = 0, $709 = 0, $71 = 0, $710 = 0, $711 = 0, $712 = 0, $713 = 0, $714 = 0, $715 = 0, $716 = 0, $717 = 0, $718 = 0, $719 = 0, $72 = 0, $720 = 0, $721 = 0, $722 = 0, $723 = 0, $724 = 0, $725 = 0;
 var $726 = 0, $727 = 0, $728 = 0, $729 = 0, $73 = 0, $730 = 0, $731 = 0, $732 = 0, $733 = 0, $734 = 0, $735 = 0, $736 = 0, $737 = 0, $738 = 0, $739 = 0, $74 = 0, $740 = 0, $741 = 0, $742 = 0, $743 = 0;
 var $744 = 0, $745 = 0, $746 = 0, $747 = 0, $748 = 0, $749 = 0, $75 = 0, $750 = 0, $751 = 0, $752 = 0, $753 = 0, $754 = 0, $755 = 0, $756 = 0, $757 = 0, $758 = 0, $759 = 0, $76 = 0, $760 = 0, $761 = 0;
 var $762 = 0, $763 = 0, $764 = 0, $765 = 0, $766 = 0, $767 = 0, $768 = 0, $769 = 0, $77 = 0, $770 = 0, $771 = 0, $772 = 0, $773 = 0, $774 = 0, $775 = 0, $776 = 0, $777 = 0, $778 = 0, $779 = 0, $78 = 0;
 var $780 = 0, $781 = 0, $782 = 0, $783 = 0, $784 = 0, $785 = 0, $786 = 0, $787 = 0, $788 = 0, $789 = 0, $79 = 0, $790 = 0, $791 = 0, $792 = 0, $793 = 0, $794 = 0, $795 = 0, $796 = 0, $797 = 0, $798 = 0;
 var $799 = 0, $8 = 0, $80 = 0, $800 = 0, $801 = 0, $802 = 0, $803 = 0, $804 = 0, $805 = 0, $806 = 0, $807 = 0, $808 = 0, $809 = 0, $81 = 0, $810 = 0, $811 = 0, $812 = 0, $813 = 0, $814 = 0, $815 = 0;
 var $816 = 0, $817 = 0, $818 = 0, $819 = 0, $82 = 0, $820 = 0, $821 = 0, $822 = 0, $823 = 0, $824 = 0, $825 = 0, $826 = 0, $827 = 0, $828 = 0, $829 = 0, $83 = 0, $830 = 0, $831 = 0, $832 = 0, $833 = 0;
 var $834 = 0, $835 = 0, $836 = 0, $837 = 0, $838 = 0, $839 = 0, $84 = 0, $840 = 0, $841 = 0, $842 = 0, $843 = 0, $844 = 0, $845 = 0, $846 = 0, $847 = 0, $848 = 0, $849 = 0, $85 = 0, $850 = 0, $851 = 0;
 var $852 = 0, $853 = 0, $854 = 0, $855 = 0, $856 = 0, $857 = 0, $858 = 0, $859 = 0, $86 = 0, $860 = 0, $861 = 0, $862 = 0, $863 = 0, $864 = 0, $865 = 0, $866 = 0, $867 = 0, $868 = 0, $869 = 0, $87 = 0;
 var $870 = 0, $871 = 0, $872 = 0, $873 = 0, $874 = 0, $875 = 0, $876 = 0, $877 = 0, $878 = 0, $879 = 0, $88 = 0, $880 = 0, $881 = 0, $882 = 0, $883 = 0, $884 = 0, $885 = 0, $886 = 0, $887 = 0, $888 = 0;
 var $889 = 0, $89 = 0, $890 = 0, $891 = 0, $892 = 0, $893 = 0, $894 = 0, $895 = 0, $896 = 0, $897 = 0, $898 = 0, $899 = 0, $9 = 0, $90 = 0, $900 = 0, $901 = 0, $902 = 0, $903 = 0, $904 = 0, $905 = 0;
 var $906 = 0, $907 = 0, $908 = 0, $909 = 0, $91 = 0, $910 = 0, $911 = 0, $912 = 0, $913 = 0, $914 = 0, $915 = 0, $916 = 0, $917 = 0, $918 = 0, $919 = 0, $92 = 0, $920 = 0, $921 = 0, $922 = 0, $923 = 0;
 var $924 = 0, $925 = 0, $926 = 0, $927 = 0, $928 = 0, $929 = 0, $93 = 0, $930 = 0, $931 = 0, $932 = 0, $933 = 0, $934 = 0, $935 = 0, $936 = 0, $937 = 0, $938 = 0, $939 = 0, $94 = 0, $940 = 0, $941 = 0;
 var $942 = 0, $943 = 0, $944 = 0, $945 = 0, $946 = 0, $947 = 0, $948 = 0, $949 = 0, $95 = 0, $950 = 0, $951 = 0, $952 = 0, $953 = 0, $954 = 0, $955 = 0, $956 = 0, $957 = 0, $958 = 0, $959 = 0, $96 = 0;
 var $960 = 0, $961 = 0, $962 = 0, $963 = 0, $964 = 0, $965 = 0, $966 = 0, $967 = 0, $968 = 0, $969 = 0, $97 = 0, $970 = 0, $971 = 0, $972 = 0, $973 = 0, $974 = 0, $975 = 0, $976 = 0, $977 = 0, $978 = 0;
 var $979 = 0, $98 = 0, $980 = 0, $981 = 0, $982 = 0, $983 = 0, $984 = 0, $985 = 0, $986 = 0, $987 = 0, $988 = 0, $989 = 0, $99 = 0, $990 = 0, $991 = 0, $992 = 0, $993 = 0, $994 = 0, $995 = 0, $996 = 0;
 var $997 = 0, $998 = 0, $999 = 0, $cond$i = 0, $cond$i$i = 0, $cond$i207 = 0, $not$$i = 0, $or$cond$i = 0, $or$cond$i213 = 0, $or$cond1$i = 0, $or$cond11$i = 0, $or$cond2$i = 0, $or$cond2$i214 = 0, $or$cond5$i = 0, $or$cond50$i = 0, $or$cond51$i = 0, $or$cond6$i = 0, $or$cond7$i = 0, $or$cond8$i = 0, $or$cond8$not$i = 0;
 var $spec$select$i = 0, $spec$select$i205 = 0, $spec$select1$i = 0, $spec$select3$i = 0, $spec$select49$i = 0, $spec$select7$i = 0, $spec$select9$i = 0, label = 0, sp = 0;
 sp = STACKTOP;
 STACKTOP = STACKTOP + 16|0; if ((STACKTOP|0) >= (STACK_MAX|0)) abortStackOverflow(16|0);
 $1 = sp;
 $2 = ($0>>>0)<(245);
 do {
  if ($2) {
   $3 = ($0>>>0)<(11);
   $4 = (($0) + 11)|0;
   $5 = $4 & -8;
   $6 = $3 ? 16 : $5;
   $7 = $6 >>> 3;
   $8 = HEAP32[1078]|0;
   $9 = $8 >>> $7;
   $10 = $9 & 3;
   $11 = ($10|0)==(0);
   if (!($11)) {
    $12 = $9 & 1;
    $13 = $12 ^ 1;
    $14 = (($13) + ($7))|0;
    $15 = $14 << 1;
    $16 = (4352 + ($15<<2)|0);
    $17 = ((($16)) + 8|0);
    $18 = HEAP32[$17>>2]|0;
    $19 = ((($18)) + 8|0);
    $20 = HEAP32[$19>>2]|0;
    $21 = ($20|0)==($16|0);
    do {
     if ($21) {
      $22 = 1 << $14;
      $23 = $22 ^ -1;
      $24 = $8 & $23;
      HEAP32[1078] = $24;
     } else {
      $25 = HEAP32[(4328)>>2]|0;
      $26 = ($25>>>0)>($20>>>0);
      if ($26) {
       _abort();
       // unreachable;
      }
      $27 = ((($20)) + 12|0);
      $28 = HEAP32[$27>>2]|0;
      $29 = ($28|0)==($18|0);
      if ($29) {
       HEAP32[$27>>2] = $16;
       HEAP32[$17>>2] = $20;
       break;
      } else {
       _abort();
       // unreachable;
      }
     }
    } while(0);
    $30 = $14 << 3;
    $31 = $30 | 3;
    $32 = ((($18)) + 4|0);
    HEAP32[$32>>2] = $31;
    $33 = (($18) + ($30)|0);
    $34 = ((($33)) + 4|0);
    $35 = HEAP32[$34>>2]|0;
    $36 = $35 | 1;
    HEAP32[$34>>2] = $36;
    $$0 = $19;
    STACKTOP = sp;return ($$0|0);
   }
   $37 = HEAP32[(4320)>>2]|0;
   $38 = ($6>>>0)>($37>>>0);
   if ($38) {
    $39 = ($9|0)==(0);
    if (!($39)) {
     $40 = $9 << $7;
     $41 = 2 << $7;
     $42 = (0 - ($41))|0;
     $43 = $41 | $42;
     $44 = $40 & $43;
     $45 = (0 - ($44))|0;
     $46 = $44 & $45;
     $47 = (($46) + -1)|0;
     $48 = $47 >>> 12;
     $49 = $48 & 16;
     $50 = $47 >>> $49;
     $51 = $50 >>> 5;
     $52 = $51 & 8;
     $53 = $52 | $49;
     $54 = $50 >>> $52;
     $55 = $54 >>> 2;
     $56 = $55 & 4;
     $57 = $53 | $56;
     $58 = $54 >>> $56;
     $59 = $58 >>> 1;
     $60 = $59 & 2;
     $61 = $57 | $60;
     $62 = $58 >>> $60;
     $63 = $62 >>> 1;
     $64 = $63 & 1;
     $65 = $61 | $64;
     $66 = $62 >>> $64;
     $67 = (($65) + ($66))|0;
     $68 = $67 << 1;
     $69 = (4352 + ($68<<2)|0);
     $70 = ((($69)) + 8|0);
     $71 = HEAP32[$70>>2]|0;
     $72 = ((($71)) + 8|0);
     $73 = HEAP32[$72>>2]|0;
     $74 = ($73|0)==($69|0);
     do {
      if ($74) {
       $75 = 1 << $67;
       $76 = $75 ^ -1;
       $77 = $8 & $76;
       HEAP32[1078] = $77;
       $98 = $77;
      } else {
       $78 = HEAP32[(4328)>>2]|0;
       $79 = ($78>>>0)>($73>>>0);
       if ($79) {
        _abort();
        // unreachable;
       }
       $80 = ((($73)) + 12|0);
       $81 = HEAP32[$80>>2]|0;
       $82 = ($81|0)==($71|0);
       if ($82) {
        HEAP32[$80>>2] = $69;
        HEAP32[$70>>2] = $73;
        $98 = $8;
        break;
       } else {
        _abort();
        // unreachable;
       }
      }
     } while(0);
     $83 = $67 << 3;
     $84 = (($83) - ($6))|0;
     $85 = $6 | 3;
     $86 = ((($71)) + 4|0);
     HEAP32[$86>>2] = $85;
     $87 = (($71) + ($6)|0);
     $88 = $84 | 1;
     $89 = ((($87)) + 4|0);
     HEAP32[$89>>2] = $88;
     $90 = (($71) + ($83)|0);
     HEAP32[$90>>2] = $84;
     $91 = ($37|0)==(0);
     if (!($91)) {
      $92 = HEAP32[(4332)>>2]|0;
      $93 = $37 >>> 3;
      $94 = $93 << 1;
      $95 = (4352 + ($94<<2)|0);
      $96 = 1 << $93;
      $97 = $98 & $96;
      $99 = ($97|0)==(0);
      if ($99) {
       $100 = $98 | $96;
       HEAP32[1078] = $100;
       $$pre = ((($95)) + 8|0);
       $$0199 = $95;$$pre$phiZ2D = $$pre;
      } else {
       $101 = ((($95)) + 8|0);
       $102 = HEAP32[$101>>2]|0;
       $103 = HEAP32[(4328)>>2]|0;
       $104 = ($103>>>0)>($102>>>0);
       if ($104) {
        _abort();
        // unreachable;
       } else {
        $$0199 = $102;$$pre$phiZ2D = $101;
       }
      }
      HEAP32[$$pre$phiZ2D>>2] = $92;
      $105 = ((($$0199)) + 12|0);
      HEAP32[$105>>2] = $92;
      $106 = ((($92)) + 8|0);
      HEAP32[$106>>2] = $$0199;
      $107 = ((($92)) + 12|0);
      HEAP32[$107>>2] = $95;
     }
     HEAP32[(4320)>>2] = $84;
     HEAP32[(4332)>>2] = $87;
     $$0 = $72;
     STACKTOP = sp;return ($$0|0);
    }
    $108 = HEAP32[(4316)>>2]|0;
    $109 = ($108|0)==(0);
    if ($109) {
     $$0197 = $6;
    } else {
     $110 = (0 - ($108))|0;
     $111 = $108 & $110;
     $112 = (($111) + -1)|0;
     $113 = $112 >>> 12;
     $114 = $113 & 16;
     $115 = $112 >>> $114;
     $116 = $115 >>> 5;
     $117 = $116 & 8;
     $118 = $117 | $114;
     $119 = $115 >>> $117;
     $120 = $119 >>> 2;
     $121 = $120 & 4;
     $122 = $118 | $121;
     $123 = $119 >>> $121;
     $124 = $123 >>> 1;
     $125 = $124 & 2;
     $126 = $122 | $125;
     $127 = $123 >>> $125;
     $128 = $127 >>> 1;
     $129 = $128 & 1;
     $130 = $126 | $129;
     $131 = $127 >>> $129;
     $132 = (($130) + ($131))|0;
     $133 = (4616 + ($132<<2)|0);
     $134 = HEAP32[$133>>2]|0;
     $135 = ((($134)) + 4|0);
     $136 = HEAP32[$135>>2]|0;
     $137 = $136 & -8;
     $138 = (($137) - ($6))|0;
     $$0189$i = $134;$$0190$i = $134;$$0191$i = $138;
     while(1) {
      $139 = ((($$0189$i)) + 16|0);
      $140 = HEAP32[$139>>2]|0;
      $141 = ($140|0)==(0|0);
      if ($141) {
       $142 = ((($$0189$i)) + 20|0);
       $143 = HEAP32[$142>>2]|0;
       $144 = ($143|0)==(0|0);
       if ($144) {
        break;
       } else {
        $146 = $143;
       }
      } else {
       $146 = $140;
      }
      $145 = ((($146)) + 4|0);
      $147 = HEAP32[$145>>2]|0;
      $148 = $147 & -8;
      $149 = (($148) - ($6))|0;
      $150 = ($149>>>0)<($$0191$i>>>0);
      $spec$select$i = $150 ? $149 : $$0191$i;
      $spec$select1$i = $150 ? $146 : $$0190$i;
      $$0189$i = $146;$$0190$i = $spec$select1$i;$$0191$i = $spec$select$i;
     }
     $151 = HEAP32[(4328)>>2]|0;
     $152 = ($151>>>0)>($$0190$i>>>0);
     if ($152) {
      _abort();
      // unreachable;
     }
     $153 = (($$0190$i) + ($6)|0);
     $154 = ($153>>>0)>($$0190$i>>>0);
     if (!($154)) {
      _abort();
      // unreachable;
     }
     $155 = ((($$0190$i)) + 24|0);
     $156 = HEAP32[$155>>2]|0;
     $157 = ((($$0190$i)) + 12|0);
     $158 = HEAP32[$157>>2]|0;
     $159 = ($158|0)==($$0190$i|0);
     do {
      if ($159) {
       $169 = ((($$0190$i)) + 20|0);
       $170 = HEAP32[$169>>2]|0;
       $171 = ($170|0)==(0|0);
       if ($171) {
        $172 = ((($$0190$i)) + 16|0);
        $173 = HEAP32[$172>>2]|0;
        $174 = ($173|0)==(0|0);
        if ($174) {
         $$3$i = 0;
         break;
        } else {
         $$1194$i$ph = $173;$$1196$i$ph = $172;
        }
       } else {
        $$1194$i$ph = $170;$$1196$i$ph = $169;
       }
       $$1194$i = $$1194$i$ph;$$1196$i = $$1196$i$ph;
       while(1) {
        $175 = ((($$1194$i)) + 20|0);
        $176 = HEAP32[$175>>2]|0;
        $177 = ($176|0)==(0|0);
        if ($177) {
         $178 = ((($$1194$i)) + 16|0);
         $179 = HEAP32[$178>>2]|0;
         $180 = ($179|0)==(0|0);
         if ($180) {
          break;
         } else {
          $$1194$i$be = $179;$$1196$i$be = $178;
         }
        } else {
         $$1194$i$be = $176;$$1196$i$be = $175;
        }
        $$1194$i = $$1194$i$be;$$1196$i = $$1196$i$be;
       }
       $181 = ($151>>>0)>($$1196$i>>>0);
       if ($181) {
        _abort();
        // unreachable;
       } else {
        HEAP32[$$1196$i>>2] = 0;
        $$3$i = $$1194$i;
        break;
       }
      } else {
       $160 = ((($$0190$i)) + 8|0);
       $161 = HEAP32[$160>>2]|0;
       $162 = ($151>>>0)>($161>>>0);
       if ($162) {
        _abort();
        // unreachable;
       }
       $163 = ((($161)) + 12|0);
       $164 = HEAP32[$163>>2]|0;
       $165 = ($164|0)==($$0190$i|0);
       if (!($165)) {
        _abort();
        // unreachable;
       }
       $166 = ((($158)) + 8|0);
       $167 = HEAP32[$166>>2]|0;
       $168 = ($167|0)==($$0190$i|0);
       if ($168) {
        HEAP32[$163>>2] = $158;
        HEAP32[$166>>2] = $161;
        $$3$i = $158;
        break;
       } else {
        _abort();
        // unreachable;
       }
      }
     } while(0);
     $182 = ($156|0)==(0|0);
     L78: do {
      if (!($182)) {
       $183 = ((($$0190$i)) + 28|0);
       $184 = HEAP32[$183>>2]|0;
       $185 = (4616 + ($184<<2)|0);
       $186 = HEAP32[$185>>2]|0;
       $187 = ($$0190$i|0)==($186|0);
       do {
        if ($187) {
         HEAP32[$185>>2] = $$3$i;
         $cond$i = ($$3$i|0)==(0|0);
         if ($cond$i) {
          $188 = 1 << $184;
          $189 = $188 ^ -1;
          $190 = $108 & $189;
          HEAP32[(4316)>>2] = $190;
          break L78;
         }
        } else {
         $191 = HEAP32[(4328)>>2]|0;
         $192 = ($191>>>0)>($156>>>0);
         if ($192) {
          _abort();
          // unreachable;
         } else {
          $193 = ((($156)) + 16|0);
          $194 = HEAP32[$193>>2]|0;
          $195 = ($194|0)==($$0190$i|0);
          $196 = ((($156)) + 20|0);
          $$sink = $195 ? $193 : $196;
          HEAP32[$$sink>>2] = $$3$i;
          $197 = ($$3$i|0)==(0|0);
          if ($197) {
           break L78;
          } else {
           break;
          }
         }
        }
       } while(0);
       $198 = HEAP32[(4328)>>2]|0;
       $199 = ($198>>>0)>($$3$i>>>0);
       if ($199) {
        _abort();
        // unreachable;
       }
       $200 = ((($$3$i)) + 24|0);
       HEAP32[$200>>2] = $156;
       $201 = ((($$0190$i)) + 16|0);
       $202 = HEAP32[$201>>2]|0;
       $203 = ($202|0)==(0|0);
       do {
        if (!($203)) {
         $204 = ($198>>>0)>($202>>>0);
         if ($204) {
          _abort();
          // unreachable;
         } else {
          $205 = ((($$3$i)) + 16|0);
          HEAP32[$205>>2] = $202;
          $206 = ((($202)) + 24|0);
          HEAP32[$206>>2] = $$3$i;
          break;
         }
        }
       } while(0);
       $207 = ((($$0190$i)) + 20|0);
       $208 = HEAP32[$207>>2]|0;
       $209 = ($208|0)==(0|0);
       if (!($209)) {
        $210 = HEAP32[(4328)>>2]|0;
        $211 = ($210>>>0)>($208>>>0);
        if ($211) {
         _abort();
         // unreachable;
        } else {
         $212 = ((($$3$i)) + 20|0);
         HEAP32[$212>>2] = $208;
         $213 = ((($208)) + 24|0);
         HEAP32[$213>>2] = $$3$i;
         break;
        }
       }
      }
     } while(0);
     $214 = ($$0191$i>>>0)<(16);
     if ($214) {
      $215 = (($$0191$i) + ($6))|0;
      $216 = $215 | 3;
      $217 = ((($$0190$i)) + 4|0);
      HEAP32[$217>>2] = $216;
      $218 = (($$0190$i) + ($215)|0);
      $219 = ((($218)) + 4|0);
      $220 = HEAP32[$219>>2]|0;
      $221 = $220 | 1;
      HEAP32[$219>>2] = $221;
     } else {
      $222 = $6 | 3;
      $223 = ((($$0190$i)) + 4|0);
      HEAP32[$223>>2] = $222;
      $224 = $$0191$i | 1;
      $225 = ((($153)) + 4|0);
      HEAP32[$225>>2] = $224;
      $226 = (($153) + ($$0191$i)|0);
      HEAP32[$226>>2] = $$0191$i;
      $227 = ($37|0)==(0);
      if (!($227)) {
       $228 = HEAP32[(4332)>>2]|0;
       $229 = $37 >>> 3;
       $230 = $229 << 1;
       $231 = (4352 + ($230<<2)|0);
       $232 = 1 << $229;
       $233 = $232 & $8;
       $234 = ($233|0)==(0);
       if ($234) {
        $235 = $232 | $8;
        HEAP32[1078] = $235;
        $$pre$i = ((($231)) + 8|0);
        $$0187$i = $231;$$pre$phi$iZ2D = $$pre$i;
       } else {
        $236 = ((($231)) + 8|0);
        $237 = HEAP32[$236>>2]|0;
        $238 = HEAP32[(4328)>>2]|0;
        $239 = ($238>>>0)>($237>>>0);
        if ($239) {
         _abort();
         // unreachable;
        } else {
         $$0187$i = $237;$$pre$phi$iZ2D = $236;
        }
       }
       HEAP32[$$pre$phi$iZ2D>>2] = $228;
       $240 = ((($$0187$i)) + 12|0);
       HEAP32[$240>>2] = $228;
       $241 = ((($228)) + 8|0);
       HEAP32[$241>>2] = $$0187$i;
       $242 = ((($228)) + 12|0);
       HEAP32[$242>>2] = $231;
      }
      HEAP32[(4320)>>2] = $$0191$i;
      HEAP32[(4332)>>2] = $153;
     }
     $243 = ((($$0190$i)) + 8|0);
     $$0 = $243;
     STACKTOP = sp;return ($$0|0);
    }
   } else {
    $$0197 = $6;
   }
  } else {
   $244 = ($0>>>0)>(4294967231);
   if ($244) {
    $$0197 = -1;
   } else {
    $245 = (($0) + 11)|0;
    $246 = $245 & -8;
    $247 = HEAP32[(4316)>>2]|0;
    $248 = ($247|0)==(0);
    if ($248) {
     $$0197 = $246;
    } else {
     $249 = (0 - ($246))|0;
     $250 = $245 >>> 8;
     $251 = ($250|0)==(0);
     if ($251) {
      $$0357$i = 0;
     } else {
      $252 = ($246>>>0)>(16777215);
      if ($252) {
       $$0357$i = 31;
      } else {
       $253 = (($250) + 1048320)|0;
       $254 = $253 >>> 16;
       $255 = $254 & 8;
       $256 = $250 << $255;
       $257 = (($256) + 520192)|0;
       $258 = $257 >>> 16;
       $259 = $258 & 4;
       $260 = $259 | $255;
       $261 = $256 << $259;
       $262 = (($261) + 245760)|0;
       $263 = $262 >>> 16;
       $264 = $263 & 2;
       $265 = $260 | $264;
       $266 = (14 - ($265))|0;
       $267 = $261 << $264;
       $268 = $267 >>> 15;
       $269 = (($266) + ($268))|0;
       $270 = $269 << 1;
       $271 = (($269) + 7)|0;
       $272 = $246 >>> $271;
       $273 = $272 & 1;
       $274 = $273 | $270;
       $$0357$i = $274;
      }
     }
     $275 = (4616 + ($$0357$i<<2)|0);
     $276 = HEAP32[$275>>2]|0;
     $277 = ($276|0)==(0|0);
     L122: do {
      if ($277) {
       $$2353$i = 0;$$3$i203 = 0;$$3348$i = $249;
       label = 85;
      } else {
       $278 = ($$0357$i|0)==(31);
       $279 = $$0357$i >>> 1;
       $280 = (25 - ($279))|0;
       $281 = $278 ? 0 : $280;
       $282 = $246 << $281;
       $$0340$i = 0;$$0345$i = $249;$$0351$i = $276;$$0358$i = $282;$$0361$i = 0;
       while(1) {
        $283 = ((($$0351$i)) + 4|0);
        $284 = HEAP32[$283>>2]|0;
        $285 = $284 & -8;
        $286 = (($285) - ($246))|0;
        $287 = ($286>>>0)<($$0345$i>>>0);
        if ($287) {
         $288 = ($286|0)==(0);
         if ($288) {
          $$420$i$ph = $$0351$i;$$434919$i$ph = 0;$$535618$i$ph = $$0351$i;
          label = 89;
          break L122;
         } else {
          $$1341$i = $$0351$i;$$1346$i = $286;
         }
        } else {
         $$1341$i = $$0340$i;$$1346$i = $$0345$i;
        }
        $289 = ((($$0351$i)) + 20|0);
        $290 = HEAP32[$289>>2]|0;
        $291 = $$0358$i >>> 31;
        $292 = (((($$0351$i)) + 16|0) + ($291<<2)|0);
        $293 = HEAP32[$292>>2]|0;
        $294 = ($290|0)==(0|0);
        $295 = ($290|0)==($293|0);
        $or$cond2$i = $294 | $295;
        $$1362$i = $or$cond2$i ? $$0361$i : $290;
        $296 = ($293|0)==(0|0);
        $spec$select7$i = $$0358$i << 1;
        if ($296) {
         $$2353$i = $$1362$i;$$3$i203 = $$1341$i;$$3348$i = $$1346$i;
         label = 85;
         break;
        } else {
         $$0340$i = $$1341$i;$$0345$i = $$1346$i;$$0351$i = $293;$$0358$i = $spec$select7$i;$$0361$i = $$1362$i;
        }
       }
      }
     } while(0);
     if ((label|0) == 85) {
      $297 = ($$2353$i|0)==(0|0);
      $298 = ($$3$i203|0)==(0|0);
      $or$cond$i = $297 & $298;
      if ($or$cond$i) {
       $299 = 2 << $$0357$i;
       $300 = (0 - ($299))|0;
       $301 = $299 | $300;
       $302 = $301 & $247;
       $303 = ($302|0)==(0);
       if ($303) {
        $$0197 = $246;
        break;
       }
       $304 = (0 - ($302))|0;
       $305 = $302 & $304;
       $306 = (($305) + -1)|0;
       $307 = $306 >>> 12;
       $308 = $307 & 16;
       $309 = $306 >>> $308;
       $310 = $309 >>> 5;
       $311 = $310 & 8;
       $312 = $311 | $308;
       $313 = $309 >>> $311;
       $314 = $313 >>> 2;
       $315 = $314 & 4;
       $316 = $312 | $315;
       $317 = $313 >>> $315;
       $318 = $317 >>> 1;
       $319 = $318 & 2;
       $320 = $316 | $319;
       $321 = $317 >>> $319;
       $322 = $321 >>> 1;
       $323 = $322 & 1;
       $324 = $320 | $323;
       $325 = $321 >>> $323;
       $326 = (($324) + ($325))|0;
       $327 = (4616 + ($326<<2)|0);
       $328 = HEAP32[$327>>2]|0;
       $$3$i203218 = 0;$$4355$i = $328;
      } else {
       $$3$i203218 = $$3$i203;$$4355$i = $$2353$i;
      }
      $329 = ($$4355$i|0)==(0|0);
      if ($329) {
       $$4$lcssa$i = $$3$i203218;$$4349$lcssa$i = $$3348$i;
      } else {
       $$420$i$ph = $$3$i203218;$$434919$i$ph = $$3348$i;$$535618$i$ph = $$4355$i;
       label = 89;
      }
     }
     if ((label|0) == 89) {
      $$420$i = $$420$i$ph;$$434919$i = $$434919$i$ph;$$535618$i = $$535618$i$ph;
      while(1) {
       $330 = ((($$535618$i)) + 4|0);
       $331 = HEAP32[$330>>2]|0;
       $332 = $331 & -8;
       $333 = (($332) - ($246))|0;
       $334 = ($333>>>0)<($$434919$i>>>0);
       $spec$select$i205 = $334 ? $333 : $$434919$i;
       $spec$select3$i = $334 ? $$535618$i : $$420$i;
       $335 = ((($$535618$i)) + 16|0);
       $336 = HEAP32[$335>>2]|0;
       $337 = ($336|0)==(0|0);
       if ($337) {
        $338 = ((($$535618$i)) + 20|0);
        $339 = HEAP32[$338>>2]|0;
        $340 = $339;
       } else {
        $340 = $336;
       }
       $341 = ($340|0)==(0|0);
       if ($341) {
        $$4$lcssa$i = $spec$select3$i;$$4349$lcssa$i = $spec$select$i205;
        break;
       } else {
        $$420$i = $spec$select3$i;$$434919$i = $spec$select$i205;$$535618$i = $340;
       }
      }
     }
     $342 = ($$4$lcssa$i|0)==(0|0);
     if ($342) {
      $$0197 = $246;
     } else {
      $343 = HEAP32[(4320)>>2]|0;
      $344 = (($343) - ($246))|0;
      $345 = ($$4349$lcssa$i>>>0)<($344>>>0);
      if ($345) {
       $346 = HEAP32[(4328)>>2]|0;
       $347 = ($346>>>0)>($$4$lcssa$i>>>0);
       if ($347) {
        _abort();
        // unreachable;
       }
       $348 = (($$4$lcssa$i) + ($246)|0);
       $349 = ($348>>>0)>($$4$lcssa$i>>>0);
       if (!($349)) {
        _abort();
        // unreachable;
       }
       $350 = ((($$4$lcssa$i)) + 24|0);
       $351 = HEAP32[$350>>2]|0;
       $352 = ((($$4$lcssa$i)) + 12|0);
       $353 = HEAP32[$352>>2]|0;
       $354 = ($353|0)==($$4$lcssa$i|0);
       do {
        if ($354) {
         $364 = ((($$4$lcssa$i)) + 20|0);
         $365 = HEAP32[$364>>2]|0;
         $366 = ($365|0)==(0|0);
         if ($366) {
          $367 = ((($$4$lcssa$i)) + 16|0);
          $368 = HEAP32[$367>>2]|0;
          $369 = ($368|0)==(0|0);
          if ($369) {
           $$3371$i = 0;
           break;
          } else {
           $$1369$i$ph = $368;$$1373$i$ph = $367;
          }
         } else {
          $$1369$i$ph = $365;$$1373$i$ph = $364;
         }
         $$1369$i = $$1369$i$ph;$$1373$i = $$1373$i$ph;
         while(1) {
          $370 = ((($$1369$i)) + 20|0);
          $371 = HEAP32[$370>>2]|0;
          $372 = ($371|0)==(0|0);
          if ($372) {
           $373 = ((($$1369$i)) + 16|0);
           $374 = HEAP32[$373>>2]|0;
           $375 = ($374|0)==(0|0);
           if ($375) {
            break;
           } else {
            $$1369$i$be = $374;$$1373$i$be = $373;
           }
          } else {
           $$1369$i$be = $371;$$1373$i$be = $370;
          }
          $$1369$i = $$1369$i$be;$$1373$i = $$1373$i$be;
         }
         $376 = ($346>>>0)>($$1373$i>>>0);
         if ($376) {
          _abort();
          // unreachable;
         } else {
          HEAP32[$$1373$i>>2] = 0;
          $$3371$i = $$1369$i;
          break;
         }
        } else {
         $355 = ((($$4$lcssa$i)) + 8|0);
         $356 = HEAP32[$355>>2]|0;
         $357 = ($346>>>0)>($356>>>0);
         if ($357) {
          _abort();
          // unreachable;
         }
         $358 = ((($356)) + 12|0);
         $359 = HEAP32[$358>>2]|0;
         $360 = ($359|0)==($$4$lcssa$i|0);
         if (!($360)) {
          _abort();
          // unreachable;
         }
         $361 = ((($353)) + 8|0);
         $362 = HEAP32[$361>>2]|0;
         $363 = ($362|0)==($$4$lcssa$i|0);
         if ($363) {
          HEAP32[$358>>2] = $353;
          HEAP32[$361>>2] = $356;
          $$3371$i = $353;
          break;
         } else {
          _abort();
          // unreachable;
         }
        }
       } while(0);
       $377 = ($351|0)==(0|0);
       L176: do {
        if ($377) {
         $469 = $247;
        } else {
         $378 = ((($$4$lcssa$i)) + 28|0);
         $379 = HEAP32[$378>>2]|0;
         $380 = (4616 + ($379<<2)|0);
         $381 = HEAP32[$380>>2]|0;
         $382 = ($$4$lcssa$i|0)==($381|0);
         do {
          if ($382) {
           HEAP32[$380>>2] = $$3371$i;
           $cond$i207 = ($$3371$i|0)==(0|0);
           if ($cond$i207) {
            $383 = 1 << $379;
            $384 = $383 ^ -1;
            $385 = $247 & $384;
            HEAP32[(4316)>>2] = $385;
            $469 = $385;
            break L176;
           }
          } else {
           $386 = HEAP32[(4328)>>2]|0;
           $387 = ($386>>>0)>($351>>>0);
           if ($387) {
            _abort();
            // unreachable;
           } else {
            $388 = ((($351)) + 16|0);
            $389 = HEAP32[$388>>2]|0;
            $390 = ($389|0)==($$4$lcssa$i|0);
            $391 = ((($351)) + 20|0);
            $$sink325 = $390 ? $388 : $391;
            HEAP32[$$sink325>>2] = $$3371$i;
            $392 = ($$3371$i|0)==(0|0);
            if ($392) {
             $469 = $247;
             break L176;
            } else {
             break;
            }
           }
          }
         } while(0);
         $393 = HEAP32[(4328)>>2]|0;
         $394 = ($393>>>0)>($$3371$i>>>0);
         if ($394) {
          _abort();
          // unreachable;
         }
         $395 = ((($$3371$i)) + 24|0);
         HEAP32[$395>>2] = $351;
         $396 = ((($$4$lcssa$i)) + 16|0);
         $397 = HEAP32[$396>>2]|0;
         $398 = ($397|0)==(0|0);
         do {
          if (!($398)) {
           $399 = ($393>>>0)>($397>>>0);
           if ($399) {
            _abort();
            // unreachable;
           } else {
            $400 = ((($$3371$i)) + 16|0);
            HEAP32[$400>>2] = $397;
            $401 = ((($397)) + 24|0);
            HEAP32[$401>>2] = $$3371$i;
            break;
           }
          }
         } while(0);
         $402 = ((($$4$lcssa$i)) + 20|0);
         $403 = HEAP32[$402>>2]|0;
         $404 = ($403|0)==(0|0);
         if ($404) {
          $469 = $247;
         } else {
          $405 = HEAP32[(4328)>>2]|0;
          $406 = ($405>>>0)>($403>>>0);
          if ($406) {
           _abort();
           // unreachable;
          } else {
           $407 = ((($$3371$i)) + 20|0);
           HEAP32[$407>>2] = $403;
           $408 = ((($403)) + 24|0);
           HEAP32[$408>>2] = $$3371$i;
           $469 = $247;
           break;
          }
         }
        }
       } while(0);
       $409 = ($$4349$lcssa$i>>>0)<(16);
       L200: do {
        if ($409) {
         $410 = (($$4349$lcssa$i) + ($246))|0;
         $411 = $410 | 3;
         $412 = ((($$4$lcssa$i)) + 4|0);
         HEAP32[$412>>2] = $411;
         $413 = (($$4$lcssa$i) + ($410)|0);
         $414 = ((($413)) + 4|0);
         $415 = HEAP32[$414>>2]|0;
         $416 = $415 | 1;
         HEAP32[$414>>2] = $416;
        } else {
         $417 = $246 | 3;
         $418 = ((($$4$lcssa$i)) + 4|0);
         HEAP32[$418>>2] = $417;
         $419 = $$4349$lcssa$i | 1;
         $420 = ((($348)) + 4|0);
         HEAP32[$420>>2] = $419;
         $421 = (($348) + ($$4349$lcssa$i)|0);
         HEAP32[$421>>2] = $$4349$lcssa$i;
         $422 = $$4349$lcssa$i >>> 3;
         $423 = ($$4349$lcssa$i>>>0)<(256);
         if ($423) {
          $424 = $422 << 1;
          $425 = (4352 + ($424<<2)|0);
          $426 = HEAP32[1078]|0;
          $427 = 1 << $422;
          $428 = $426 & $427;
          $429 = ($428|0)==(0);
          if ($429) {
           $430 = $426 | $427;
           HEAP32[1078] = $430;
           $$pre$i208 = ((($425)) + 8|0);
           $$0367$i = $425;$$pre$phi$i209Z2D = $$pre$i208;
          } else {
           $431 = ((($425)) + 8|0);
           $432 = HEAP32[$431>>2]|0;
           $433 = HEAP32[(4328)>>2]|0;
           $434 = ($433>>>0)>($432>>>0);
           if ($434) {
            _abort();
            // unreachable;
           } else {
            $$0367$i = $432;$$pre$phi$i209Z2D = $431;
           }
          }
          HEAP32[$$pre$phi$i209Z2D>>2] = $348;
          $435 = ((($$0367$i)) + 12|0);
          HEAP32[$435>>2] = $348;
          $436 = ((($348)) + 8|0);
          HEAP32[$436>>2] = $$0367$i;
          $437 = ((($348)) + 12|0);
          HEAP32[$437>>2] = $425;
          break;
         }
         $438 = $$4349$lcssa$i >>> 8;
         $439 = ($438|0)==(0);
         if ($439) {
          $$0360$i = 0;
         } else {
          $440 = ($$4349$lcssa$i>>>0)>(16777215);
          if ($440) {
           $$0360$i = 31;
          } else {
           $441 = (($438) + 1048320)|0;
           $442 = $441 >>> 16;
           $443 = $442 & 8;
           $444 = $438 << $443;
           $445 = (($444) + 520192)|0;
           $446 = $445 >>> 16;
           $447 = $446 & 4;
           $448 = $447 | $443;
           $449 = $444 << $447;
           $450 = (($449) + 245760)|0;
           $451 = $450 >>> 16;
           $452 = $451 & 2;
           $453 = $448 | $452;
           $454 = (14 - ($453))|0;
           $455 = $449 << $452;
           $456 = $455 >>> 15;
           $457 = (($454) + ($456))|0;
           $458 = $457 << 1;
           $459 = (($457) + 7)|0;
           $460 = $$4349$lcssa$i >>> $459;
           $461 = $460 & 1;
           $462 = $461 | $458;
           $$0360$i = $462;
          }
         }
         $463 = (4616 + ($$0360$i<<2)|0);
         $464 = ((($348)) + 28|0);
         HEAP32[$464>>2] = $$0360$i;
         $465 = ((($348)) + 16|0);
         $466 = ((($465)) + 4|0);
         HEAP32[$466>>2] = 0;
         HEAP32[$465>>2] = 0;
         $467 = 1 << $$0360$i;
         $468 = $469 & $467;
         $470 = ($468|0)==(0);
         if ($470) {
          $471 = $469 | $467;
          HEAP32[(4316)>>2] = $471;
          HEAP32[$463>>2] = $348;
          $472 = ((($348)) + 24|0);
          HEAP32[$472>>2] = $463;
          $473 = ((($348)) + 12|0);
          HEAP32[$473>>2] = $348;
          $474 = ((($348)) + 8|0);
          HEAP32[$474>>2] = $348;
          break;
         }
         $475 = HEAP32[$463>>2]|0;
         $476 = ((($475)) + 4|0);
         $477 = HEAP32[$476>>2]|0;
         $478 = $477 & -8;
         $479 = ($478|0)==($$4349$lcssa$i|0);
         L218: do {
          if ($479) {
           $$0343$lcssa$i = $475;
          } else {
           $480 = ($$0360$i|0)==(31);
           $481 = $$0360$i >>> 1;
           $482 = (25 - ($481))|0;
           $483 = $480 ? 0 : $482;
           $484 = $$4349$lcssa$i << $483;
           $$034217$i = $484;$$034316$i = $475;
           while(1) {
            $491 = $$034217$i >>> 31;
            $492 = (((($$034316$i)) + 16|0) + ($491<<2)|0);
            $487 = HEAP32[$492>>2]|0;
            $493 = ($487|0)==(0|0);
            if ($493) {
             break;
            }
            $485 = $$034217$i << 1;
            $486 = ((($487)) + 4|0);
            $488 = HEAP32[$486>>2]|0;
            $489 = $488 & -8;
            $490 = ($489|0)==($$4349$lcssa$i|0);
            if ($490) {
             $$0343$lcssa$i = $487;
             break L218;
            } else {
             $$034217$i = $485;$$034316$i = $487;
            }
           }
           $494 = HEAP32[(4328)>>2]|0;
           $495 = ($494>>>0)>($492>>>0);
           if ($495) {
            _abort();
            // unreachable;
           } else {
            HEAP32[$492>>2] = $348;
            $496 = ((($348)) + 24|0);
            HEAP32[$496>>2] = $$034316$i;
            $497 = ((($348)) + 12|0);
            HEAP32[$497>>2] = $348;
            $498 = ((($348)) + 8|0);
            HEAP32[$498>>2] = $348;
            break L200;
           }
          }
         } while(0);
         $499 = ((($$0343$lcssa$i)) + 8|0);
         $500 = HEAP32[$499>>2]|0;
         $501 = HEAP32[(4328)>>2]|0;
         $502 = ($501>>>0)<=($$0343$lcssa$i>>>0);
         $503 = ($501>>>0)<=($500>>>0);
         $504 = $503 & $502;
         if ($504) {
          $505 = ((($500)) + 12|0);
          HEAP32[$505>>2] = $348;
          HEAP32[$499>>2] = $348;
          $506 = ((($348)) + 8|0);
          HEAP32[$506>>2] = $500;
          $507 = ((($348)) + 12|0);
          HEAP32[$507>>2] = $$0343$lcssa$i;
          $508 = ((($348)) + 24|0);
          HEAP32[$508>>2] = 0;
          break;
         } else {
          _abort();
          // unreachable;
         }
        }
       } while(0);
       $509 = ((($$4$lcssa$i)) + 8|0);
       $$0 = $509;
       STACKTOP = sp;return ($$0|0);
      } else {
       $$0197 = $246;
      }
     }
    }
   }
  }
 } while(0);
 $510 = HEAP32[(4320)>>2]|0;
 $511 = ($510>>>0)<($$0197>>>0);
 if (!($511)) {
  $512 = (($510) - ($$0197))|0;
  $513 = HEAP32[(4332)>>2]|0;
  $514 = ($512>>>0)>(15);
  if ($514) {
   $515 = (($513) + ($$0197)|0);
   HEAP32[(4332)>>2] = $515;
   HEAP32[(4320)>>2] = $512;
   $516 = $512 | 1;
   $517 = ((($515)) + 4|0);
   HEAP32[$517>>2] = $516;
   $518 = (($513) + ($510)|0);
   HEAP32[$518>>2] = $512;
   $519 = $$0197 | 3;
   $520 = ((($513)) + 4|0);
   HEAP32[$520>>2] = $519;
  } else {
   HEAP32[(4320)>>2] = 0;
   HEAP32[(4332)>>2] = 0;
   $521 = $510 | 3;
   $522 = ((($513)) + 4|0);
   HEAP32[$522>>2] = $521;
   $523 = (($513) + ($510)|0);
   $524 = ((($523)) + 4|0);
   $525 = HEAP32[$524>>2]|0;
   $526 = $525 | 1;
   HEAP32[$524>>2] = $526;
  }
  $527 = ((($513)) + 8|0);
  $$0 = $527;
  STACKTOP = sp;return ($$0|0);
 }
 $528 = HEAP32[(4324)>>2]|0;
 $529 = ($528>>>0)>($$0197>>>0);
 if ($529) {
  $530 = (($528) - ($$0197))|0;
  HEAP32[(4324)>>2] = $530;
  $531 = HEAP32[(4336)>>2]|0;
  $532 = (($531) + ($$0197)|0);
  HEAP32[(4336)>>2] = $532;
  $533 = $530 | 1;
  $534 = ((($532)) + 4|0);
  HEAP32[$534>>2] = $533;
  $535 = $$0197 | 3;
  $536 = ((($531)) + 4|0);
  HEAP32[$536>>2] = $535;
  $537 = ((($531)) + 8|0);
  $$0 = $537;
  STACKTOP = sp;return ($$0|0);
 }
 $538 = HEAP32[1196]|0;
 $539 = ($538|0)==(0);
 if ($539) {
  HEAP32[(4792)>>2] = 4096;
  HEAP32[(4788)>>2] = 4096;
  HEAP32[(4796)>>2] = -1;
  HEAP32[(4800)>>2] = -1;
  HEAP32[(4804)>>2] = 0;
  HEAP32[(4756)>>2] = 0;
  $540 = $1;
  $541 = $540 & -16;
  $542 = $541 ^ 1431655768;
  HEAP32[1196] = $542;
  $546 = 4096;
 } else {
  $$pre$i210 = HEAP32[(4792)>>2]|0;
  $546 = $$pre$i210;
 }
 $543 = (($$0197) + 48)|0;
 $544 = (($$0197) + 47)|0;
 $545 = (($546) + ($544))|0;
 $547 = (0 - ($546))|0;
 $548 = $545 & $547;
 $549 = ($548>>>0)>($$0197>>>0);
 if (!($549)) {
  $$0 = 0;
  STACKTOP = sp;return ($$0|0);
 }
 $550 = HEAP32[(4752)>>2]|0;
 $551 = ($550|0)==(0);
 if (!($551)) {
  $552 = HEAP32[(4744)>>2]|0;
  $553 = (($552) + ($548))|0;
  $554 = ($553>>>0)<=($552>>>0);
  $555 = ($553>>>0)>($550>>>0);
  $or$cond1$i = $554 | $555;
  if ($or$cond1$i) {
   $$0 = 0;
   STACKTOP = sp;return ($$0|0);
  }
 }
 $556 = HEAP32[(4756)>>2]|0;
 $557 = $556 & 4;
 $558 = ($557|0)==(0);
 L257: do {
  if ($558) {
   $559 = HEAP32[(4336)>>2]|0;
   $560 = ($559|0)==(0|0);
   L259: do {
    if ($560) {
     label = 173;
    } else {
     $$0$i$i = (4760);
     while(1) {
      $561 = HEAP32[$$0$i$i>>2]|0;
      $562 = ($561>>>0)>($559>>>0);
      if (!($562)) {
       $563 = ((($$0$i$i)) + 4|0);
       $564 = HEAP32[$563>>2]|0;
       $565 = (($561) + ($564)|0);
       $566 = ($565>>>0)>($559>>>0);
       if ($566) {
        break;
       }
      }
      $567 = ((($$0$i$i)) + 8|0);
      $568 = HEAP32[$567>>2]|0;
      $569 = ($568|0)==(0|0);
      if ($569) {
       label = 173;
       break L259;
      } else {
       $$0$i$i = $568;
      }
     }
     $592 = (($545) - ($528))|0;
     $593 = $592 & $547;
     $594 = ($593>>>0)<(2147483647);
     if ($594) {
      $595 = ((($$0$i$i)) + 4|0);
      $596 = (_sbrk(($593|0))|0);
      $597 = HEAP32[$$0$i$i>>2]|0;
      $598 = HEAP32[$595>>2]|0;
      $599 = (($597) + ($598)|0);
      $600 = ($596|0)==($599|0);
      if ($600) {
       $601 = ($596|0)==((-1)|0);
       if ($601) {
        $$2234243136$i = $593;
       } else {
        $$723947$i = $593;$$748$i = $596;
        label = 190;
        break L257;
       }
      } else {
       $$2247$ph$i = $596;$$2253$ph$i = $593;
       label = 181;
      }
     } else {
      $$2234243136$i = 0;
     }
    }
   } while(0);
   do {
    if ((label|0) == 173) {
     $570 = (_sbrk(0)|0);
     $571 = ($570|0)==((-1)|0);
     if ($571) {
      $$2234243136$i = 0;
     } else {
      $572 = $570;
      $573 = HEAP32[(4788)>>2]|0;
      $574 = (($573) + -1)|0;
      $575 = $574 & $572;
      $576 = ($575|0)==(0);
      $577 = (($574) + ($572))|0;
      $578 = (0 - ($573))|0;
      $579 = $577 & $578;
      $580 = (($579) - ($572))|0;
      $581 = $576 ? 0 : $580;
      $spec$select49$i = (($581) + ($548))|0;
      $582 = HEAP32[(4744)>>2]|0;
      $583 = (($spec$select49$i) + ($582))|0;
      $584 = ($spec$select49$i>>>0)>($$0197>>>0);
      $585 = ($spec$select49$i>>>0)<(2147483647);
      $or$cond$i213 = $584 & $585;
      if ($or$cond$i213) {
       $586 = HEAP32[(4752)>>2]|0;
       $587 = ($586|0)==(0);
       if (!($587)) {
        $588 = ($583>>>0)<=($582>>>0);
        $589 = ($583>>>0)>($586>>>0);
        $or$cond2$i214 = $588 | $589;
        if ($or$cond2$i214) {
         $$2234243136$i = 0;
         break;
        }
       }
       $590 = (_sbrk(($spec$select49$i|0))|0);
       $591 = ($590|0)==($570|0);
       if ($591) {
        $$723947$i = $spec$select49$i;$$748$i = $570;
        label = 190;
        break L257;
       } else {
        $$2247$ph$i = $590;$$2253$ph$i = $spec$select49$i;
        label = 181;
       }
      } else {
       $$2234243136$i = 0;
      }
     }
    }
   } while(0);
   do {
    if ((label|0) == 181) {
     $602 = (0 - ($$2253$ph$i))|0;
     $603 = ($$2247$ph$i|0)!=((-1)|0);
     $604 = ($$2253$ph$i>>>0)<(2147483647);
     $or$cond7$i = $604 & $603;
     $605 = ($543>>>0)>($$2253$ph$i>>>0);
     $or$cond6$i = $605 & $or$cond7$i;
     if (!($or$cond6$i)) {
      $615 = ($$2247$ph$i|0)==((-1)|0);
      if ($615) {
       $$2234243136$i = 0;
       break;
      } else {
       $$723947$i = $$2253$ph$i;$$748$i = $$2247$ph$i;
       label = 190;
       break L257;
      }
     }
     $606 = HEAP32[(4792)>>2]|0;
     $607 = (($544) - ($$2253$ph$i))|0;
     $608 = (($607) + ($606))|0;
     $609 = (0 - ($606))|0;
     $610 = $608 & $609;
     $611 = ($610>>>0)<(2147483647);
     if (!($611)) {
      $$723947$i = $$2253$ph$i;$$748$i = $$2247$ph$i;
      label = 190;
      break L257;
     }
     $612 = (_sbrk(($610|0))|0);
     $613 = ($612|0)==((-1)|0);
     if ($613) {
      (_sbrk(($602|0))|0);
      $$2234243136$i = 0;
      break;
     } else {
      $614 = (($610) + ($$2253$ph$i))|0;
      $$723947$i = $614;$$748$i = $$2247$ph$i;
      label = 190;
      break L257;
     }
    }
   } while(0);
   $616 = HEAP32[(4756)>>2]|0;
   $617 = $616 | 4;
   HEAP32[(4756)>>2] = $617;
   $$4236$i = $$2234243136$i;
   label = 188;
  } else {
   $$4236$i = 0;
   label = 188;
  }
 } while(0);
 if ((label|0) == 188) {
  $618 = ($548>>>0)<(2147483647);
  if ($618) {
   $619 = (_sbrk(($548|0))|0);
   $620 = (_sbrk(0)|0);
   $621 = ($619|0)!=((-1)|0);
   $622 = ($620|0)!=((-1)|0);
   $or$cond5$i = $621 & $622;
   $623 = ($619>>>0)<($620>>>0);
   $or$cond8$i = $623 & $or$cond5$i;
   $624 = $620;
   $625 = $619;
   $626 = (($624) - ($625))|0;
   $627 = (($$0197) + 40)|0;
   $628 = ($626>>>0)>($627>>>0);
   $spec$select9$i = $628 ? $626 : $$4236$i;
   $or$cond8$not$i = $or$cond8$i ^ 1;
   $629 = ($619|0)==((-1)|0);
   $not$$i = $628 ^ 1;
   $630 = $629 | $not$$i;
   $or$cond50$i = $630 | $or$cond8$not$i;
   if (!($or$cond50$i)) {
    $$723947$i = $spec$select9$i;$$748$i = $619;
    label = 190;
   }
  }
 }
 if ((label|0) == 190) {
  $631 = HEAP32[(4744)>>2]|0;
  $632 = (($631) + ($$723947$i))|0;
  HEAP32[(4744)>>2] = $632;
  $633 = HEAP32[(4748)>>2]|0;
  $634 = ($632>>>0)>($633>>>0);
  if ($634) {
   HEAP32[(4748)>>2] = $632;
  }
  $635 = HEAP32[(4336)>>2]|0;
  $636 = ($635|0)==(0|0);
  L294: do {
   if ($636) {
    $637 = HEAP32[(4328)>>2]|0;
    $638 = ($637|0)==(0|0);
    $639 = ($$748$i>>>0)<($637>>>0);
    $or$cond11$i = $638 | $639;
    if ($or$cond11$i) {
     HEAP32[(4328)>>2] = $$748$i;
    }
    HEAP32[(4760)>>2] = $$748$i;
    HEAP32[(4764)>>2] = $$723947$i;
    HEAP32[(4772)>>2] = 0;
    $640 = HEAP32[1196]|0;
    HEAP32[(4348)>>2] = $640;
    HEAP32[(4344)>>2] = -1;
    HEAP32[(4364)>>2] = (4352);
    HEAP32[(4360)>>2] = (4352);
    HEAP32[(4372)>>2] = (4360);
    HEAP32[(4368)>>2] = (4360);
    HEAP32[(4380)>>2] = (4368);
    HEAP32[(4376)>>2] = (4368);
    HEAP32[(4388)>>2] = (4376);
    HEAP32[(4384)>>2] = (4376);
    HEAP32[(4396)>>2] = (4384);
    HEAP32[(4392)>>2] = (4384);
    HEAP32[(4404)>>2] = (4392);
    HEAP32[(4400)>>2] = (4392);
    HEAP32[(4412)>>2] = (4400);
    HEAP32[(4408)>>2] = (4400);
    HEAP32[(4420)>>2] = (4408);
    HEAP32[(4416)>>2] = (4408);
    HEAP32[(4428)>>2] = (4416);
    HEAP32[(4424)>>2] = (4416);
    HEAP32[(4436)>>2] = (4424);
    HEAP32[(4432)>>2] = (4424);
    HEAP32[(4444)>>2] = (4432);
    HEAP32[(4440)>>2] = (4432);
    HEAP32[(4452)>>2] = (4440);
    HEAP32[(4448)>>2] = (4440);
    HEAP32[(4460)>>2] = (4448);
    HEAP32[(4456)>>2] = (4448);
    HEAP32[(4468)>>2] = (4456);
    HEAP32[(4464)>>2] = (4456);
    HEAP32[(4476)>>2] = (4464);
    HEAP32[(4472)>>2] = (4464);
    HEAP32[(4484)>>2] = (4472);
    HEAP32[(4480)>>2] = (4472);
    HEAP32[(4492)>>2] = (4480);
    HEAP32[(4488)>>2] = (4480);
    HEAP32[(4500)>>2] = (4488);
    HEAP32[(4496)>>2] = (4488);
    HEAP32[(4508)>>2] = (4496);
    HEAP32[(4504)>>2] = (4496);
    HEAP32[(4516)>>2] = (4504);
    HEAP32[(4512)>>2] = (4504);
    HEAP32[(4524)>>2] = (4512);
    HEAP32[(4520)>>2] = (4512);
    HEAP32[(4532)>>2] = (4520);
    HEAP32[(4528)>>2] = (4520);
    HEAP32[(4540)>>2] = (4528);
    HEAP32[(4536)>>2] = (4528);
    HEAP32[(4548)>>2] = (4536);
    HEAP32[(4544)>>2] = (4536);
    HEAP32[(4556)>>2] = (4544);
    HEAP32[(4552)>>2] = (4544);
    HEAP32[(4564)>>2] = (4552);
    HEAP32[(4560)>>2] = (4552);
    HEAP32[(4572)>>2] = (4560);
    HEAP32[(4568)>>2] = (4560);
    HEAP32[(4580)>>2] = (4568);
    HEAP32[(4576)>>2] = (4568);
    HEAP32[(4588)>>2] = (4576);
    HEAP32[(4584)>>2] = (4576);
    HEAP32[(4596)>>2] = (4584);
    HEAP32[(4592)>>2] = (4584);
    HEAP32[(4604)>>2] = (4592);
    HEAP32[(4600)>>2] = (4592);
    HEAP32[(4612)>>2] = (4600);
    HEAP32[(4608)>>2] = (4600);
    $641 = (($$723947$i) + -40)|0;
    $642 = ((($$748$i)) + 8|0);
    $643 = $642;
    $644 = $643 & 7;
    $645 = ($644|0)==(0);
    $646 = (0 - ($643))|0;
    $647 = $646 & 7;
    $648 = $645 ? 0 : $647;
    $649 = (($$748$i) + ($648)|0);
    $650 = (($641) - ($648))|0;
    HEAP32[(4336)>>2] = $649;
    HEAP32[(4324)>>2] = $650;
    $651 = $650 | 1;
    $652 = ((($649)) + 4|0);
    HEAP32[$652>>2] = $651;
    $653 = (($$748$i) + ($641)|0);
    $654 = ((($653)) + 4|0);
    HEAP32[$654>>2] = 40;
    $655 = HEAP32[(4800)>>2]|0;
    HEAP32[(4340)>>2] = $655;
   } else {
    $$024372$i = (4760);
    while(1) {
     $656 = HEAP32[$$024372$i>>2]|0;
     $657 = ((($$024372$i)) + 4|0);
     $658 = HEAP32[$657>>2]|0;
     $659 = (($656) + ($658)|0);
     $660 = ($$748$i|0)==($659|0);
     if ($660) {
      label = 199;
      break;
     }
     $661 = ((($$024372$i)) + 8|0);
     $662 = HEAP32[$661>>2]|0;
     $663 = ($662|0)==(0|0);
     if ($663) {
      break;
     } else {
      $$024372$i = $662;
     }
    }
    if ((label|0) == 199) {
     $664 = ((($$024372$i)) + 4|0);
     $665 = ((($$024372$i)) + 12|0);
     $666 = HEAP32[$665>>2]|0;
     $667 = $666 & 8;
     $668 = ($667|0)==(0);
     if ($668) {
      $669 = ($656>>>0)<=($635>>>0);
      $670 = ($$748$i>>>0)>($635>>>0);
      $or$cond51$i = $670 & $669;
      if ($or$cond51$i) {
       $671 = (($658) + ($$723947$i))|0;
       HEAP32[$664>>2] = $671;
       $672 = HEAP32[(4324)>>2]|0;
       $673 = (($672) + ($$723947$i))|0;
       $674 = ((($635)) + 8|0);
       $675 = $674;
       $676 = $675 & 7;
       $677 = ($676|0)==(0);
       $678 = (0 - ($675))|0;
       $679 = $678 & 7;
       $680 = $677 ? 0 : $679;
       $681 = (($635) + ($680)|0);
       $682 = (($673) - ($680))|0;
       HEAP32[(4336)>>2] = $681;
       HEAP32[(4324)>>2] = $682;
       $683 = $682 | 1;
       $684 = ((($681)) + 4|0);
       HEAP32[$684>>2] = $683;
       $685 = (($635) + ($673)|0);
       $686 = ((($685)) + 4|0);
       HEAP32[$686>>2] = 40;
       $687 = HEAP32[(4800)>>2]|0;
       HEAP32[(4340)>>2] = $687;
       break;
      }
     }
    }
    $688 = HEAP32[(4328)>>2]|0;
    $689 = ($$748$i>>>0)<($688>>>0);
    if ($689) {
     HEAP32[(4328)>>2] = $$748$i;
     $752 = $$748$i;
    } else {
     $752 = $688;
    }
    $690 = (($$748$i) + ($$723947$i)|0);
    $$124471$i = (4760);
    while(1) {
     $691 = HEAP32[$$124471$i>>2]|0;
     $692 = ($691|0)==($690|0);
     if ($692) {
      label = 207;
      break;
     }
     $693 = ((($$124471$i)) + 8|0);
     $694 = HEAP32[$693>>2]|0;
     $695 = ($694|0)==(0|0);
     if ($695) {
      break;
     } else {
      $$124471$i = $694;
     }
    }
    if ((label|0) == 207) {
     $696 = ((($$124471$i)) + 12|0);
     $697 = HEAP32[$696>>2]|0;
     $698 = $697 & 8;
     $699 = ($698|0)==(0);
     if ($699) {
      HEAP32[$$124471$i>>2] = $$748$i;
      $700 = ((($$124471$i)) + 4|0);
      $701 = HEAP32[$700>>2]|0;
      $702 = (($701) + ($$723947$i))|0;
      HEAP32[$700>>2] = $702;
      $703 = ((($$748$i)) + 8|0);
      $704 = $703;
      $705 = $704 & 7;
      $706 = ($705|0)==(0);
      $707 = (0 - ($704))|0;
      $708 = $707 & 7;
      $709 = $706 ? 0 : $708;
      $710 = (($$748$i) + ($709)|0);
      $711 = ((($690)) + 8|0);
      $712 = $711;
      $713 = $712 & 7;
      $714 = ($713|0)==(0);
      $715 = (0 - ($712))|0;
      $716 = $715 & 7;
      $717 = $714 ? 0 : $716;
      $718 = (($690) + ($717)|0);
      $719 = $718;
      $720 = $710;
      $721 = (($719) - ($720))|0;
      $722 = (($710) + ($$0197)|0);
      $723 = (($721) - ($$0197))|0;
      $724 = $$0197 | 3;
      $725 = ((($710)) + 4|0);
      HEAP32[$725>>2] = $724;
      $726 = ($635|0)==($718|0);
      L317: do {
       if ($726) {
        $727 = HEAP32[(4324)>>2]|0;
        $728 = (($727) + ($723))|0;
        HEAP32[(4324)>>2] = $728;
        HEAP32[(4336)>>2] = $722;
        $729 = $728 | 1;
        $730 = ((($722)) + 4|0);
        HEAP32[$730>>2] = $729;
       } else {
        $731 = HEAP32[(4332)>>2]|0;
        $732 = ($731|0)==($718|0);
        if ($732) {
         $733 = HEAP32[(4320)>>2]|0;
         $734 = (($733) + ($723))|0;
         HEAP32[(4320)>>2] = $734;
         HEAP32[(4332)>>2] = $722;
         $735 = $734 | 1;
         $736 = ((($722)) + 4|0);
         HEAP32[$736>>2] = $735;
         $737 = (($722) + ($734)|0);
         HEAP32[$737>>2] = $734;
         break;
        }
        $738 = ((($718)) + 4|0);
        $739 = HEAP32[$738>>2]|0;
        $740 = $739 & 3;
        $741 = ($740|0)==(1);
        if ($741) {
         $742 = $739 & -8;
         $743 = $739 >>> 3;
         $744 = ($739>>>0)<(256);
         L325: do {
          if ($744) {
           $745 = ((($718)) + 8|0);
           $746 = HEAP32[$745>>2]|0;
           $747 = ((($718)) + 12|0);
           $748 = HEAP32[$747>>2]|0;
           $749 = $743 << 1;
           $750 = (4352 + ($749<<2)|0);
           $751 = ($746|0)==($750|0);
           do {
            if (!($751)) {
             $753 = ($752>>>0)>($746>>>0);
             if ($753) {
              _abort();
              // unreachable;
             }
             $754 = ((($746)) + 12|0);
             $755 = HEAP32[$754>>2]|0;
             $756 = ($755|0)==($718|0);
             if ($756) {
              break;
             }
             _abort();
             // unreachable;
            }
           } while(0);
           $757 = ($748|0)==($746|0);
           if ($757) {
            $758 = 1 << $743;
            $759 = $758 ^ -1;
            $760 = HEAP32[1078]|0;
            $761 = $760 & $759;
            HEAP32[1078] = $761;
            break;
           }
           $762 = ($748|0)==($750|0);
           do {
            if ($762) {
             $$pre16$i$i = ((($748)) + 8|0);
             $$pre$phi17$i$iZ2D = $$pre16$i$i;
            } else {
             $763 = ($752>>>0)>($748>>>0);
             if ($763) {
              _abort();
              // unreachable;
             }
             $764 = ((($748)) + 8|0);
             $765 = HEAP32[$764>>2]|0;
             $766 = ($765|0)==($718|0);
             if ($766) {
              $$pre$phi17$i$iZ2D = $764;
              break;
             }
             _abort();
             // unreachable;
            }
           } while(0);
           $767 = ((($746)) + 12|0);
           HEAP32[$767>>2] = $748;
           HEAP32[$$pre$phi17$i$iZ2D>>2] = $746;
          } else {
           $768 = ((($718)) + 24|0);
           $769 = HEAP32[$768>>2]|0;
           $770 = ((($718)) + 12|0);
           $771 = HEAP32[$770>>2]|0;
           $772 = ($771|0)==($718|0);
           do {
            if ($772) {
             $782 = ((($718)) + 16|0);
             $783 = ((($782)) + 4|0);
             $784 = HEAP32[$783>>2]|0;
             $785 = ($784|0)==(0|0);
             if ($785) {
              $786 = HEAP32[$782>>2]|0;
              $787 = ($786|0)==(0|0);
              if ($787) {
               $$3$i$i = 0;
               break;
              } else {
               $$1290$i$i$ph = $786;$$1292$i$i$ph = $782;
              }
             } else {
              $$1290$i$i$ph = $784;$$1292$i$i$ph = $783;
             }
             $$1290$i$i = $$1290$i$i$ph;$$1292$i$i = $$1292$i$i$ph;
             while(1) {
              $788 = ((($$1290$i$i)) + 20|0);
              $789 = HEAP32[$788>>2]|0;
              $790 = ($789|0)==(0|0);
              if ($790) {
               $791 = ((($$1290$i$i)) + 16|0);
               $792 = HEAP32[$791>>2]|0;
               $793 = ($792|0)==(0|0);
               if ($793) {
                break;
               } else {
                $$1290$i$i$be = $792;$$1292$i$i$be = $791;
               }
              } else {
               $$1290$i$i$be = $789;$$1292$i$i$be = $788;
              }
              $$1290$i$i = $$1290$i$i$be;$$1292$i$i = $$1292$i$i$be;
             }
             $794 = ($752>>>0)>($$1292$i$i>>>0);
             if ($794) {
              _abort();
              // unreachable;
             } else {
              HEAP32[$$1292$i$i>>2] = 0;
              $$3$i$i = $$1290$i$i;
              break;
             }
            } else {
             $773 = ((($718)) + 8|0);
             $774 = HEAP32[$773>>2]|0;
             $775 = ($752>>>0)>($774>>>0);
             if ($775) {
              _abort();
              // unreachable;
             }
             $776 = ((($774)) + 12|0);
             $777 = HEAP32[$776>>2]|0;
             $778 = ($777|0)==($718|0);
             if (!($778)) {
              _abort();
              // unreachable;
             }
             $779 = ((($771)) + 8|0);
             $780 = HEAP32[$779>>2]|0;
             $781 = ($780|0)==($718|0);
             if ($781) {
              HEAP32[$776>>2] = $771;
              HEAP32[$779>>2] = $774;
              $$3$i$i = $771;
              break;
             } else {
              _abort();
              // unreachable;
             }
            }
           } while(0);
           $795 = ($769|0)==(0|0);
           if ($795) {
            break;
           }
           $796 = ((($718)) + 28|0);
           $797 = HEAP32[$796>>2]|0;
           $798 = (4616 + ($797<<2)|0);
           $799 = HEAP32[$798>>2]|0;
           $800 = ($799|0)==($718|0);
           do {
            if ($800) {
             HEAP32[$798>>2] = $$3$i$i;
             $cond$i$i = ($$3$i$i|0)==(0|0);
             if (!($cond$i$i)) {
              break;
             }
             $801 = 1 << $797;
             $802 = $801 ^ -1;
             $803 = HEAP32[(4316)>>2]|0;
             $804 = $803 & $802;
             HEAP32[(4316)>>2] = $804;
             break L325;
            } else {
             $805 = HEAP32[(4328)>>2]|0;
             $806 = ($805>>>0)>($769>>>0);
             if ($806) {
              _abort();
              // unreachable;
             } else {
              $807 = ((($769)) + 16|0);
              $808 = HEAP32[$807>>2]|0;
              $809 = ($808|0)==($718|0);
              $810 = ((($769)) + 20|0);
              $$sink326 = $809 ? $807 : $810;
              HEAP32[$$sink326>>2] = $$3$i$i;
              $811 = ($$3$i$i|0)==(0|0);
              if ($811) {
               break L325;
              } else {
               break;
              }
             }
            }
           } while(0);
           $812 = HEAP32[(4328)>>2]|0;
           $813 = ($812>>>0)>($$3$i$i>>>0);
           if ($813) {
            _abort();
            // unreachable;
           }
           $814 = ((($$3$i$i)) + 24|0);
           HEAP32[$814>>2] = $769;
           $815 = ((($718)) + 16|0);
           $816 = HEAP32[$815>>2]|0;
           $817 = ($816|0)==(0|0);
           do {
            if (!($817)) {
             $818 = ($812>>>0)>($816>>>0);
             if ($818) {
              _abort();
              // unreachable;
             } else {
              $819 = ((($$3$i$i)) + 16|0);
              HEAP32[$819>>2] = $816;
              $820 = ((($816)) + 24|0);
              HEAP32[$820>>2] = $$3$i$i;
              break;
             }
            }
           } while(0);
           $821 = ((($815)) + 4|0);
           $822 = HEAP32[$821>>2]|0;
           $823 = ($822|0)==(0|0);
           if ($823) {
            break;
           }
           $824 = HEAP32[(4328)>>2]|0;
           $825 = ($824>>>0)>($822>>>0);
           if ($825) {
            _abort();
            // unreachable;
           } else {
            $826 = ((($$3$i$i)) + 20|0);
            HEAP32[$826>>2] = $822;
            $827 = ((($822)) + 24|0);
            HEAP32[$827>>2] = $$3$i$i;
            break;
           }
          }
         } while(0);
         $828 = (($718) + ($742)|0);
         $829 = (($742) + ($723))|0;
         $$0$i16$i = $828;$$0286$i$i = $829;
        } else {
         $$0$i16$i = $718;$$0286$i$i = $723;
        }
        $830 = ((($$0$i16$i)) + 4|0);
        $831 = HEAP32[$830>>2]|0;
        $832 = $831 & -2;
        HEAP32[$830>>2] = $832;
        $833 = $$0286$i$i | 1;
        $834 = ((($722)) + 4|0);
        HEAP32[$834>>2] = $833;
        $835 = (($722) + ($$0286$i$i)|0);
        HEAP32[$835>>2] = $$0286$i$i;
        $836 = $$0286$i$i >>> 3;
        $837 = ($$0286$i$i>>>0)<(256);
        if ($837) {
         $838 = $836 << 1;
         $839 = (4352 + ($838<<2)|0);
         $840 = HEAP32[1078]|0;
         $841 = 1 << $836;
         $842 = $840 & $841;
         $843 = ($842|0)==(0);
         do {
          if ($843) {
           $844 = $840 | $841;
           HEAP32[1078] = $844;
           $$pre$i17$i = ((($839)) + 8|0);
           $$0294$i$i = $839;$$pre$phi$i18$iZ2D = $$pre$i17$i;
          } else {
           $845 = ((($839)) + 8|0);
           $846 = HEAP32[$845>>2]|0;
           $847 = HEAP32[(4328)>>2]|0;
           $848 = ($847>>>0)>($846>>>0);
           if (!($848)) {
            $$0294$i$i = $846;$$pre$phi$i18$iZ2D = $845;
            break;
           }
           _abort();
           // unreachable;
          }
         } while(0);
         HEAP32[$$pre$phi$i18$iZ2D>>2] = $722;
         $849 = ((($$0294$i$i)) + 12|0);
         HEAP32[$849>>2] = $722;
         $850 = ((($722)) + 8|0);
         HEAP32[$850>>2] = $$0294$i$i;
         $851 = ((($722)) + 12|0);
         HEAP32[$851>>2] = $839;
         break;
        }
        $852 = $$0286$i$i >>> 8;
        $853 = ($852|0)==(0);
        do {
         if ($853) {
          $$0295$i$i = 0;
         } else {
          $854 = ($$0286$i$i>>>0)>(16777215);
          if ($854) {
           $$0295$i$i = 31;
           break;
          }
          $855 = (($852) + 1048320)|0;
          $856 = $855 >>> 16;
          $857 = $856 & 8;
          $858 = $852 << $857;
          $859 = (($858) + 520192)|0;
          $860 = $859 >>> 16;
          $861 = $860 & 4;
          $862 = $861 | $857;
          $863 = $858 << $861;
          $864 = (($863) + 245760)|0;
          $865 = $864 >>> 16;
          $866 = $865 & 2;
          $867 = $862 | $866;
          $868 = (14 - ($867))|0;
          $869 = $863 << $866;
          $870 = $869 >>> 15;
          $871 = (($868) + ($870))|0;
          $872 = $871 << 1;
          $873 = (($871) + 7)|0;
          $874 = $$0286$i$i >>> $873;
          $875 = $874 & 1;
          $876 = $875 | $872;
          $$0295$i$i = $876;
         }
        } while(0);
        $877 = (4616 + ($$0295$i$i<<2)|0);
        $878 = ((($722)) + 28|0);
        HEAP32[$878>>2] = $$0295$i$i;
        $879 = ((($722)) + 16|0);
        $880 = ((($879)) + 4|0);
        HEAP32[$880>>2] = 0;
        HEAP32[$879>>2] = 0;
        $881 = HEAP32[(4316)>>2]|0;
        $882 = 1 << $$0295$i$i;
        $883 = $881 & $882;
        $884 = ($883|0)==(0);
        if ($884) {
         $885 = $881 | $882;
         HEAP32[(4316)>>2] = $885;
         HEAP32[$877>>2] = $722;
         $886 = ((($722)) + 24|0);
         HEAP32[$886>>2] = $877;
         $887 = ((($722)) + 12|0);
         HEAP32[$887>>2] = $722;
         $888 = ((($722)) + 8|0);
         HEAP32[$888>>2] = $722;
         break;
        }
        $889 = HEAP32[$877>>2]|0;
        $890 = ((($889)) + 4|0);
        $891 = HEAP32[$890>>2]|0;
        $892 = $891 & -8;
        $893 = ($892|0)==($$0286$i$i|0);
        L410: do {
         if ($893) {
          $$0288$lcssa$i$i = $889;
         } else {
          $894 = ($$0295$i$i|0)==(31);
          $895 = $$0295$i$i >>> 1;
          $896 = (25 - ($895))|0;
          $897 = $894 ? 0 : $896;
          $898 = $$0286$i$i << $897;
          $$028711$i$i = $898;$$028810$i$i = $889;
          while(1) {
           $905 = $$028711$i$i >>> 31;
           $906 = (((($$028810$i$i)) + 16|0) + ($905<<2)|0);
           $901 = HEAP32[$906>>2]|0;
           $907 = ($901|0)==(0|0);
           if ($907) {
            break;
           }
           $899 = $$028711$i$i << 1;
           $900 = ((($901)) + 4|0);
           $902 = HEAP32[$900>>2]|0;
           $903 = $902 & -8;
           $904 = ($903|0)==($$0286$i$i|0);
           if ($904) {
            $$0288$lcssa$i$i = $901;
            break L410;
           } else {
            $$028711$i$i = $899;$$028810$i$i = $901;
           }
          }
          $908 = HEAP32[(4328)>>2]|0;
          $909 = ($908>>>0)>($906>>>0);
          if ($909) {
           _abort();
           // unreachable;
          } else {
           HEAP32[$906>>2] = $722;
           $910 = ((($722)) + 24|0);
           HEAP32[$910>>2] = $$028810$i$i;
           $911 = ((($722)) + 12|0);
           HEAP32[$911>>2] = $722;
           $912 = ((($722)) + 8|0);
           HEAP32[$912>>2] = $722;
           break L317;
          }
         }
        } while(0);
        $913 = ((($$0288$lcssa$i$i)) + 8|0);
        $914 = HEAP32[$913>>2]|0;
        $915 = HEAP32[(4328)>>2]|0;
        $916 = ($915>>>0)<=($$0288$lcssa$i$i>>>0);
        $917 = ($915>>>0)<=($914>>>0);
        $918 = $917 & $916;
        if ($918) {
         $919 = ((($914)) + 12|0);
         HEAP32[$919>>2] = $722;
         HEAP32[$913>>2] = $722;
         $920 = ((($722)) + 8|0);
         HEAP32[$920>>2] = $914;
         $921 = ((($722)) + 12|0);
         HEAP32[$921>>2] = $$0288$lcssa$i$i;
         $922 = ((($722)) + 24|0);
         HEAP32[$922>>2] = 0;
         break;
        } else {
         _abort();
         // unreachable;
        }
       }
      } while(0);
      $1059 = ((($710)) + 8|0);
      $$0 = $1059;
      STACKTOP = sp;return ($$0|0);
     }
    }
    $$0$i$i$i = (4760);
    while(1) {
     $923 = HEAP32[$$0$i$i$i>>2]|0;
     $924 = ($923>>>0)>($635>>>0);
     if (!($924)) {
      $925 = ((($$0$i$i$i)) + 4|0);
      $926 = HEAP32[$925>>2]|0;
      $927 = (($923) + ($926)|0);
      $928 = ($927>>>0)>($635>>>0);
      if ($928) {
       break;
      }
     }
     $929 = ((($$0$i$i$i)) + 8|0);
     $930 = HEAP32[$929>>2]|0;
     $$0$i$i$i = $930;
    }
    $931 = ((($927)) + -47|0);
    $932 = ((($931)) + 8|0);
    $933 = $932;
    $934 = $933 & 7;
    $935 = ($934|0)==(0);
    $936 = (0 - ($933))|0;
    $937 = $936 & 7;
    $938 = $935 ? 0 : $937;
    $939 = (($931) + ($938)|0);
    $940 = ((($635)) + 16|0);
    $941 = ($939>>>0)<($940>>>0);
    $942 = $941 ? $635 : $939;
    $943 = ((($942)) + 8|0);
    $944 = ((($942)) + 24|0);
    $945 = (($$723947$i) + -40)|0;
    $946 = ((($$748$i)) + 8|0);
    $947 = $946;
    $948 = $947 & 7;
    $949 = ($948|0)==(0);
    $950 = (0 - ($947))|0;
    $951 = $950 & 7;
    $952 = $949 ? 0 : $951;
    $953 = (($$748$i) + ($952)|0);
    $954 = (($945) - ($952))|0;
    HEAP32[(4336)>>2] = $953;
    HEAP32[(4324)>>2] = $954;
    $955 = $954 | 1;
    $956 = ((($953)) + 4|0);
    HEAP32[$956>>2] = $955;
    $957 = (($$748$i) + ($945)|0);
    $958 = ((($957)) + 4|0);
    HEAP32[$958>>2] = 40;
    $959 = HEAP32[(4800)>>2]|0;
    HEAP32[(4340)>>2] = $959;
    $960 = ((($942)) + 4|0);
    HEAP32[$960>>2] = 27;
    ;HEAP32[$943>>2]=HEAP32[(4760)>>2]|0;HEAP32[$943+4>>2]=HEAP32[(4760)+4>>2]|0;HEAP32[$943+8>>2]=HEAP32[(4760)+8>>2]|0;HEAP32[$943+12>>2]=HEAP32[(4760)+12>>2]|0;
    HEAP32[(4760)>>2] = $$748$i;
    HEAP32[(4764)>>2] = $$723947$i;
    HEAP32[(4772)>>2] = 0;
    HEAP32[(4768)>>2] = $943;
    $962 = $944;
    while(1) {
     $961 = ((($962)) + 4|0);
     HEAP32[$961>>2] = 7;
     $963 = ((($962)) + 8|0);
     $964 = ($963>>>0)<($927>>>0);
     if ($964) {
      $962 = $961;
     } else {
      break;
     }
    }
    $965 = ($942|0)==($635|0);
    if (!($965)) {
     $966 = $942;
     $967 = $635;
     $968 = (($966) - ($967))|0;
     $969 = HEAP32[$960>>2]|0;
     $970 = $969 & -2;
     HEAP32[$960>>2] = $970;
     $971 = $968 | 1;
     $972 = ((($635)) + 4|0);
     HEAP32[$972>>2] = $971;
     HEAP32[$942>>2] = $968;
     $973 = $968 >>> 3;
     $974 = ($968>>>0)<(256);
     if ($974) {
      $975 = $973 << 1;
      $976 = (4352 + ($975<<2)|0);
      $977 = HEAP32[1078]|0;
      $978 = 1 << $973;
      $979 = $977 & $978;
      $980 = ($979|0)==(0);
      if ($980) {
       $981 = $977 | $978;
       HEAP32[1078] = $981;
       $$pre$i$i = ((($976)) + 8|0);
       $$0211$i$i = $976;$$pre$phi$i$iZ2D = $$pre$i$i;
      } else {
       $982 = ((($976)) + 8|0);
       $983 = HEAP32[$982>>2]|0;
       $984 = HEAP32[(4328)>>2]|0;
       $985 = ($984>>>0)>($983>>>0);
       if ($985) {
        _abort();
        // unreachable;
       } else {
        $$0211$i$i = $983;$$pre$phi$i$iZ2D = $982;
       }
      }
      HEAP32[$$pre$phi$i$iZ2D>>2] = $635;
      $986 = ((($$0211$i$i)) + 12|0);
      HEAP32[$986>>2] = $635;
      $987 = ((($635)) + 8|0);
      HEAP32[$987>>2] = $$0211$i$i;
      $988 = ((($635)) + 12|0);
      HEAP32[$988>>2] = $976;
      break;
     }
     $989 = $968 >>> 8;
     $990 = ($989|0)==(0);
     if ($990) {
      $$0212$i$i = 0;
     } else {
      $991 = ($968>>>0)>(16777215);
      if ($991) {
       $$0212$i$i = 31;
      } else {
       $992 = (($989) + 1048320)|0;
       $993 = $992 >>> 16;
       $994 = $993 & 8;
       $995 = $989 << $994;
       $996 = (($995) + 520192)|0;
       $997 = $996 >>> 16;
       $998 = $997 & 4;
       $999 = $998 | $994;
       $1000 = $995 << $998;
       $1001 = (($1000) + 245760)|0;
       $1002 = $1001 >>> 16;
       $1003 = $1002 & 2;
       $1004 = $999 | $1003;
       $1005 = (14 - ($1004))|0;
       $1006 = $1000 << $1003;
       $1007 = $1006 >>> 15;
       $1008 = (($1005) + ($1007))|0;
       $1009 = $1008 << 1;
       $1010 = (($1008) + 7)|0;
       $1011 = $968 >>> $1010;
       $1012 = $1011 & 1;
       $1013 = $1012 | $1009;
       $$0212$i$i = $1013;
      }
     }
     $1014 = (4616 + ($$0212$i$i<<2)|0);
     $1015 = ((($635)) + 28|0);
     HEAP32[$1015>>2] = $$0212$i$i;
     $1016 = ((($635)) + 20|0);
     HEAP32[$1016>>2] = 0;
     HEAP32[$940>>2] = 0;
     $1017 = HEAP32[(4316)>>2]|0;
     $1018 = 1 << $$0212$i$i;
     $1019 = $1017 & $1018;
     $1020 = ($1019|0)==(0);
     if ($1020) {
      $1021 = $1017 | $1018;
      HEAP32[(4316)>>2] = $1021;
      HEAP32[$1014>>2] = $635;
      $1022 = ((($635)) + 24|0);
      HEAP32[$1022>>2] = $1014;
      $1023 = ((($635)) + 12|0);
      HEAP32[$1023>>2] = $635;
      $1024 = ((($635)) + 8|0);
      HEAP32[$1024>>2] = $635;
      break;
     }
     $1025 = HEAP32[$1014>>2]|0;
     $1026 = ((($1025)) + 4|0);
     $1027 = HEAP32[$1026>>2]|0;
     $1028 = $1027 & -8;
     $1029 = ($1028|0)==($968|0);
     L451: do {
      if ($1029) {
       $$0207$lcssa$i$i = $1025;
      } else {
       $1030 = ($$0212$i$i|0)==(31);
       $1031 = $$0212$i$i >>> 1;
       $1032 = (25 - ($1031))|0;
       $1033 = $1030 ? 0 : $1032;
       $1034 = $968 << $1033;
       $$02065$i$i = $1034;$$02074$i$i = $1025;
       while(1) {
        $1041 = $$02065$i$i >>> 31;
        $1042 = (((($$02074$i$i)) + 16|0) + ($1041<<2)|0);
        $1037 = HEAP32[$1042>>2]|0;
        $1043 = ($1037|0)==(0|0);
        if ($1043) {
         break;
        }
        $1035 = $$02065$i$i << 1;
        $1036 = ((($1037)) + 4|0);
        $1038 = HEAP32[$1036>>2]|0;
        $1039 = $1038 & -8;
        $1040 = ($1039|0)==($968|0);
        if ($1040) {
         $$0207$lcssa$i$i = $1037;
         break L451;
        } else {
         $$02065$i$i = $1035;$$02074$i$i = $1037;
        }
       }
       $1044 = HEAP32[(4328)>>2]|0;
       $1045 = ($1044>>>0)>($1042>>>0);
       if ($1045) {
        _abort();
        // unreachable;
       } else {
        HEAP32[$1042>>2] = $635;
        $1046 = ((($635)) + 24|0);
        HEAP32[$1046>>2] = $$02074$i$i;
        $1047 = ((($635)) + 12|0);
        HEAP32[$1047>>2] = $635;
        $1048 = ((($635)) + 8|0);
        HEAP32[$1048>>2] = $635;
        break L294;
       }
      }
     } while(0);
     $1049 = ((($$0207$lcssa$i$i)) + 8|0);
     $1050 = HEAP32[$1049>>2]|0;
     $1051 = HEAP32[(4328)>>2]|0;
     $1052 = ($1051>>>0)<=($$0207$lcssa$i$i>>>0);
     $1053 = ($1051>>>0)<=($1050>>>0);
     $1054 = $1053 & $1052;
     if ($1054) {
      $1055 = ((($1050)) + 12|0);
      HEAP32[$1055>>2] = $635;
      HEAP32[$1049>>2] = $635;
      $1056 = ((($635)) + 8|0);
      HEAP32[$1056>>2] = $1050;
      $1057 = ((($635)) + 12|0);
      HEAP32[$1057>>2] = $$0207$lcssa$i$i;
      $1058 = ((($635)) + 24|0);
      HEAP32[$1058>>2] = 0;
      break;
     } else {
      _abort();
      // unreachable;
     }
    }
   }
  } while(0);
  $1060 = HEAP32[(4324)>>2]|0;
  $1061 = ($1060>>>0)>($$0197>>>0);
  if ($1061) {
   $1062 = (($1060) - ($$0197))|0;
   HEAP32[(4324)>>2] = $1062;
   $1063 = HEAP32[(4336)>>2]|0;
   $1064 = (($1063) + ($$0197)|0);
   HEAP32[(4336)>>2] = $1064;
   $1065 = $1062 | 1;
   $1066 = ((($1064)) + 4|0);
   HEAP32[$1066>>2] = $1065;
   $1067 = $$0197 | 3;
   $1068 = ((($1063)) + 4|0);
   HEAP32[$1068>>2] = $1067;
   $1069 = ((($1063)) + 8|0);
   $$0 = $1069;
   STACKTOP = sp;return ($$0|0);
  }
 }
 $1070 = (___errno_location()|0);
 HEAP32[$1070>>2] = 12;
 $$0 = 0;
 STACKTOP = sp;return ($$0|0);
}
function _free($0) {
 $0 = $0|0;
 var $$0211$i = 0, $$0211$in$i = 0, $$0381438 = 0, $$0382$lcssa = 0, $$0382437 = 0, $$0394 = 0, $$0401 = 0, $$1 = 0, $$1380 = 0, $$1385 = 0, $$1385$be = 0, $$1385$ph = 0, $$1388 = 0, $$1388$be = 0, $$1388$ph = 0, $$1396 = 0, $$1396$be = 0, $$1396$ph = 0, $$1400 = 0, $$1400$be = 0;
 var $$1400$ph = 0, $$2 = 0, $$3 = 0, $$3398 = 0, $$pre = 0, $$pre$phi444Z2D = 0, $$pre$phi446Z2D = 0, $$pre$phiZ2D = 0, $$pre443 = 0, $$pre445 = 0, $$sink = 0, $$sink456 = 0, $1 = 0, $10 = 0, $100 = 0, $101 = 0, $102 = 0, $103 = 0, $104 = 0, $105 = 0;
 var $106 = 0, $107 = 0, $108 = 0, $109 = 0, $11 = 0, $110 = 0, $111 = 0, $112 = 0, $113 = 0, $114 = 0, $115 = 0, $116 = 0, $117 = 0, $118 = 0, $119 = 0, $12 = 0, $120 = 0, $121 = 0, $122 = 0, $123 = 0;
 var $124 = 0, $125 = 0, $126 = 0, $127 = 0, $128 = 0, $129 = 0, $13 = 0, $130 = 0, $131 = 0, $132 = 0, $133 = 0, $134 = 0, $135 = 0, $136 = 0, $137 = 0, $138 = 0, $139 = 0, $14 = 0, $140 = 0, $141 = 0;
 var $142 = 0, $143 = 0, $144 = 0, $145 = 0, $146 = 0, $147 = 0, $148 = 0, $149 = 0, $15 = 0, $150 = 0, $151 = 0, $152 = 0, $153 = 0, $154 = 0, $155 = 0, $156 = 0, $157 = 0, $158 = 0, $159 = 0, $16 = 0;
 var $160 = 0, $161 = 0, $162 = 0, $163 = 0, $164 = 0, $165 = 0, $166 = 0, $167 = 0, $168 = 0, $169 = 0, $17 = 0, $170 = 0, $171 = 0, $172 = 0, $173 = 0, $174 = 0, $175 = 0, $176 = 0, $177 = 0, $178 = 0;
 var $179 = 0, $18 = 0, $180 = 0, $181 = 0, $182 = 0, $183 = 0, $184 = 0, $185 = 0, $186 = 0, $187 = 0, $188 = 0, $189 = 0, $19 = 0, $190 = 0, $191 = 0, $192 = 0, $193 = 0, $194 = 0, $195 = 0, $196 = 0;
 var $197 = 0, $198 = 0, $199 = 0, $2 = 0, $20 = 0, $200 = 0, $201 = 0, $202 = 0, $203 = 0, $204 = 0, $205 = 0, $206 = 0, $207 = 0, $208 = 0, $209 = 0, $21 = 0, $210 = 0, $211 = 0, $212 = 0, $213 = 0;
 var $214 = 0, $215 = 0, $216 = 0, $217 = 0, $218 = 0, $219 = 0, $22 = 0, $220 = 0, $221 = 0, $222 = 0, $223 = 0, $224 = 0, $225 = 0, $226 = 0, $227 = 0, $228 = 0, $229 = 0, $23 = 0, $230 = 0, $231 = 0;
 var $232 = 0, $233 = 0, $234 = 0, $235 = 0, $236 = 0, $237 = 0, $238 = 0, $239 = 0, $24 = 0, $240 = 0, $241 = 0, $242 = 0, $243 = 0, $244 = 0, $245 = 0, $246 = 0, $247 = 0, $248 = 0, $249 = 0, $25 = 0;
 var $250 = 0, $251 = 0, $252 = 0, $253 = 0, $254 = 0, $255 = 0, $256 = 0, $257 = 0, $258 = 0, $259 = 0, $26 = 0, $260 = 0, $261 = 0, $262 = 0, $263 = 0, $264 = 0, $265 = 0, $266 = 0, $267 = 0, $268 = 0;
 var $269 = 0, $27 = 0, $270 = 0, $271 = 0, $272 = 0, $273 = 0, $274 = 0, $275 = 0, $276 = 0, $277 = 0, $278 = 0, $279 = 0, $28 = 0, $280 = 0, $281 = 0, $282 = 0, $283 = 0, $284 = 0, $285 = 0, $286 = 0;
 var $287 = 0, $288 = 0, $289 = 0, $29 = 0, $290 = 0, $291 = 0, $292 = 0, $293 = 0, $294 = 0, $295 = 0, $296 = 0, $297 = 0, $298 = 0, $299 = 0, $3 = 0, $30 = 0, $300 = 0, $301 = 0, $302 = 0, $303 = 0;
 var $304 = 0, $305 = 0, $306 = 0, $307 = 0, $308 = 0, $309 = 0, $31 = 0, $310 = 0, $311 = 0, $312 = 0, $313 = 0, $314 = 0, $315 = 0, $316 = 0, $317 = 0, $318 = 0, $319 = 0, $32 = 0, $320 = 0, $321 = 0;
 var $322 = 0, $323 = 0, $324 = 0, $325 = 0, $326 = 0, $33 = 0, $34 = 0, $35 = 0, $36 = 0, $37 = 0, $38 = 0, $39 = 0, $4 = 0, $40 = 0, $41 = 0, $42 = 0, $43 = 0, $44 = 0, $45 = 0, $46 = 0;
 var $47 = 0, $48 = 0, $49 = 0, $5 = 0, $50 = 0, $51 = 0, $52 = 0, $53 = 0, $54 = 0, $55 = 0, $56 = 0, $57 = 0, $58 = 0, $59 = 0, $6 = 0, $60 = 0, $61 = 0, $62 = 0, $63 = 0, $64 = 0;
 var $65 = 0, $66 = 0, $67 = 0, $68 = 0, $69 = 0, $7 = 0, $70 = 0, $71 = 0, $72 = 0, $73 = 0, $74 = 0, $75 = 0, $76 = 0, $77 = 0, $78 = 0, $79 = 0, $8 = 0, $80 = 0, $81 = 0, $82 = 0;
 var $83 = 0, $84 = 0, $85 = 0, $86 = 0, $87 = 0, $88 = 0, $89 = 0, $9 = 0, $90 = 0, $91 = 0, $92 = 0, $93 = 0, $94 = 0, $95 = 0, $96 = 0, $97 = 0, $98 = 0, $99 = 0, $cond419 = 0, $cond420 = 0;
 var label = 0, sp = 0;
 sp = STACKTOP;
 $1 = ($0|0)==(0|0);
 if ($1) {
  return;
 }
 $2 = ((($0)) + -8|0);
 $3 = HEAP32[(4328)>>2]|0;
 $4 = ($2>>>0)<($3>>>0);
 if ($4) {
  _abort();
  // unreachable;
 }
 $5 = ((($0)) + -4|0);
 $6 = HEAP32[$5>>2]|0;
 $7 = $6 & 3;
 $8 = ($7|0)==(1);
 if ($8) {
  _abort();
  // unreachable;
 }
 $9 = $6 & -8;
 $10 = (($2) + ($9)|0);
 $11 = $6 & 1;
 $12 = ($11|0)==(0);
 L10: do {
  if ($12) {
   $13 = HEAP32[$2>>2]|0;
   $14 = ($7|0)==(0);
   if ($14) {
    return;
   }
   $15 = (0 - ($13))|0;
   $16 = (($2) + ($15)|0);
   $17 = (($13) + ($9))|0;
   $18 = ($16>>>0)<($3>>>0);
   if ($18) {
    _abort();
    // unreachable;
   }
   $19 = HEAP32[(4332)>>2]|0;
   $20 = ($19|0)==($16|0);
   if ($20) {
    $105 = ((($10)) + 4|0);
    $106 = HEAP32[$105>>2]|0;
    $107 = $106 & 3;
    $108 = ($107|0)==(3);
    if (!($108)) {
     $$1 = $16;$$1380 = $17;$113 = $16;
     break;
    }
    $109 = (($16) + ($17)|0);
    $110 = ((($16)) + 4|0);
    $111 = $17 | 1;
    $112 = $106 & -2;
    HEAP32[(4320)>>2] = $17;
    HEAP32[$105>>2] = $112;
    HEAP32[$110>>2] = $111;
    HEAP32[$109>>2] = $17;
    return;
   }
   $21 = $13 >>> 3;
   $22 = ($13>>>0)<(256);
   if ($22) {
    $23 = ((($16)) + 8|0);
    $24 = HEAP32[$23>>2]|0;
    $25 = ((($16)) + 12|0);
    $26 = HEAP32[$25>>2]|0;
    $27 = $21 << 1;
    $28 = (4352 + ($27<<2)|0);
    $29 = ($24|0)==($28|0);
    if (!($29)) {
     $30 = ($3>>>0)>($24>>>0);
     if ($30) {
      _abort();
      // unreachable;
     }
     $31 = ((($24)) + 12|0);
     $32 = HEAP32[$31>>2]|0;
     $33 = ($32|0)==($16|0);
     if (!($33)) {
      _abort();
      // unreachable;
     }
    }
    $34 = ($26|0)==($24|0);
    if ($34) {
     $35 = 1 << $21;
     $36 = $35 ^ -1;
     $37 = HEAP32[1078]|0;
     $38 = $37 & $36;
     HEAP32[1078] = $38;
     $$1 = $16;$$1380 = $17;$113 = $16;
     break;
    }
    $39 = ($26|0)==($28|0);
    if ($39) {
     $$pre445 = ((($26)) + 8|0);
     $$pre$phi446Z2D = $$pre445;
    } else {
     $40 = ($3>>>0)>($26>>>0);
     if ($40) {
      _abort();
      // unreachable;
     }
     $41 = ((($26)) + 8|0);
     $42 = HEAP32[$41>>2]|0;
     $43 = ($42|0)==($16|0);
     if ($43) {
      $$pre$phi446Z2D = $41;
     } else {
      _abort();
      // unreachable;
     }
    }
    $44 = ((($24)) + 12|0);
    HEAP32[$44>>2] = $26;
    HEAP32[$$pre$phi446Z2D>>2] = $24;
    $$1 = $16;$$1380 = $17;$113 = $16;
    break;
   }
   $45 = ((($16)) + 24|0);
   $46 = HEAP32[$45>>2]|0;
   $47 = ((($16)) + 12|0);
   $48 = HEAP32[$47>>2]|0;
   $49 = ($48|0)==($16|0);
   do {
    if ($49) {
     $59 = ((($16)) + 16|0);
     $60 = ((($59)) + 4|0);
     $61 = HEAP32[$60>>2]|0;
     $62 = ($61|0)==(0|0);
     if ($62) {
      $63 = HEAP32[$59>>2]|0;
      $64 = ($63|0)==(0|0);
      if ($64) {
       $$3 = 0;
       break;
      } else {
       $$1385$ph = $63;$$1388$ph = $59;
      }
     } else {
      $$1385$ph = $61;$$1388$ph = $60;
     }
     $$1385 = $$1385$ph;$$1388 = $$1388$ph;
     while(1) {
      $65 = ((($$1385)) + 20|0);
      $66 = HEAP32[$65>>2]|0;
      $67 = ($66|0)==(0|0);
      if ($67) {
       $68 = ((($$1385)) + 16|0);
       $69 = HEAP32[$68>>2]|0;
       $70 = ($69|0)==(0|0);
       if ($70) {
        break;
       } else {
        $$1385$be = $69;$$1388$be = $68;
       }
      } else {
       $$1385$be = $66;$$1388$be = $65;
      }
      $$1385 = $$1385$be;$$1388 = $$1388$be;
     }
     $71 = ($3>>>0)>($$1388>>>0);
     if ($71) {
      _abort();
      // unreachable;
     } else {
      HEAP32[$$1388>>2] = 0;
      $$3 = $$1385;
      break;
     }
    } else {
     $50 = ((($16)) + 8|0);
     $51 = HEAP32[$50>>2]|0;
     $52 = ($3>>>0)>($51>>>0);
     if ($52) {
      _abort();
      // unreachable;
     }
     $53 = ((($51)) + 12|0);
     $54 = HEAP32[$53>>2]|0;
     $55 = ($54|0)==($16|0);
     if (!($55)) {
      _abort();
      // unreachable;
     }
     $56 = ((($48)) + 8|0);
     $57 = HEAP32[$56>>2]|0;
     $58 = ($57|0)==($16|0);
     if ($58) {
      HEAP32[$53>>2] = $48;
      HEAP32[$56>>2] = $51;
      $$3 = $48;
      break;
     } else {
      _abort();
      // unreachable;
     }
    }
   } while(0);
   $72 = ($46|0)==(0|0);
   if ($72) {
    $$1 = $16;$$1380 = $17;$113 = $16;
   } else {
    $73 = ((($16)) + 28|0);
    $74 = HEAP32[$73>>2]|0;
    $75 = (4616 + ($74<<2)|0);
    $76 = HEAP32[$75>>2]|0;
    $77 = ($76|0)==($16|0);
    do {
     if ($77) {
      HEAP32[$75>>2] = $$3;
      $cond419 = ($$3|0)==(0|0);
      if ($cond419) {
       $78 = 1 << $74;
       $79 = $78 ^ -1;
       $80 = HEAP32[(4316)>>2]|0;
       $81 = $80 & $79;
       HEAP32[(4316)>>2] = $81;
       $$1 = $16;$$1380 = $17;$113 = $16;
       break L10;
      }
     } else {
      $82 = HEAP32[(4328)>>2]|0;
      $83 = ($82>>>0)>($46>>>0);
      if ($83) {
       _abort();
       // unreachable;
      } else {
       $84 = ((($46)) + 16|0);
       $85 = HEAP32[$84>>2]|0;
       $86 = ($85|0)==($16|0);
       $87 = ((($46)) + 20|0);
       $$sink = $86 ? $84 : $87;
       HEAP32[$$sink>>2] = $$3;
       $88 = ($$3|0)==(0|0);
       if ($88) {
        $$1 = $16;$$1380 = $17;$113 = $16;
        break L10;
       } else {
        break;
       }
      }
     }
    } while(0);
    $89 = HEAP32[(4328)>>2]|0;
    $90 = ($89>>>0)>($$3>>>0);
    if ($90) {
     _abort();
     // unreachable;
    }
    $91 = ((($$3)) + 24|0);
    HEAP32[$91>>2] = $46;
    $92 = ((($16)) + 16|0);
    $93 = HEAP32[$92>>2]|0;
    $94 = ($93|0)==(0|0);
    do {
     if (!($94)) {
      $95 = ($89>>>0)>($93>>>0);
      if ($95) {
       _abort();
       // unreachable;
      } else {
       $96 = ((($$3)) + 16|0);
       HEAP32[$96>>2] = $93;
       $97 = ((($93)) + 24|0);
       HEAP32[$97>>2] = $$3;
       break;
      }
     }
    } while(0);
    $98 = ((($92)) + 4|0);
    $99 = HEAP32[$98>>2]|0;
    $100 = ($99|0)==(0|0);
    if ($100) {
     $$1 = $16;$$1380 = $17;$113 = $16;
    } else {
     $101 = HEAP32[(4328)>>2]|0;
     $102 = ($101>>>0)>($99>>>0);
     if ($102) {
      _abort();
      // unreachable;
     } else {
      $103 = ((($$3)) + 20|0);
      HEAP32[$103>>2] = $99;
      $104 = ((($99)) + 24|0);
      HEAP32[$104>>2] = $$3;
      $$1 = $16;$$1380 = $17;$113 = $16;
      break;
     }
    }
   }
  } else {
   $$1 = $2;$$1380 = $9;$113 = $2;
  }
 } while(0);
 $114 = ($113>>>0)<($10>>>0);
 if (!($114)) {
  _abort();
  // unreachable;
 }
 $115 = ((($10)) + 4|0);
 $116 = HEAP32[$115>>2]|0;
 $117 = $116 & 1;
 $118 = ($117|0)==(0);
 if ($118) {
  _abort();
  // unreachable;
 }
 $119 = $116 & 2;
 $120 = ($119|0)==(0);
 if ($120) {
  $121 = HEAP32[(4336)>>2]|0;
  $122 = ($121|0)==($10|0);
  if ($122) {
   $123 = HEAP32[(4324)>>2]|0;
   $124 = (($123) + ($$1380))|0;
   HEAP32[(4324)>>2] = $124;
   HEAP32[(4336)>>2] = $$1;
   $125 = $124 | 1;
   $126 = ((($$1)) + 4|0);
   HEAP32[$126>>2] = $125;
   $127 = HEAP32[(4332)>>2]|0;
   $128 = ($$1|0)==($127|0);
   if (!($128)) {
    return;
   }
   HEAP32[(4332)>>2] = 0;
   HEAP32[(4320)>>2] = 0;
   return;
  }
  $129 = HEAP32[(4332)>>2]|0;
  $130 = ($129|0)==($10|0);
  if ($130) {
   $131 = HEAP32[(4320)>>2]|0;
   $132 = (($131) + ($$1380))|0;
   HEAP32[(4320)>>2] = $132;
   HEAP32[(4332)>>2] = $113;
   $133 = $132 | 1;
   $134 = ((($$1)) + 4|0);
   HEAP32[$134>>2] = $133;
   $135 = (($113) + ($132)|0);
   HEAP32[$135>>2] = $132;
   return;
  }
  $136 = $116 & -8;
  $137 = (($136) + ($$1380))|0;
  $138 = $116 >>> 3;
  $139 = ($116>>>0)<(256);
  L111: do {
   if ($139) {
    $140 = ((($10)) + 8|0);
    $141 = HEAP32[$140>>2]|0;
    $142 = ((($10)) + 12|0);
    $143 = HEAP32[$142>>2]|0;
    $144 = $138 << 1;
    $145 = (4352 + ($144<<2)|0);
    $146 = ($141|0)==($145|0);
    if (!($146)) {
     $147 = HEAP32[(4328)>>2]|0;
     $148 = ($147>>>0)>($141>>>0);
     if ($148) {
      _abort();
      // unreachable;
     }
     $149 = ((($141)) + 12|0);
     $150 = HEAP32[$149>>2]|0;
     $151 = ($150|0)==($10|0);
     if (!($151)) {
      _abort();
      // unreachable;
     }
    }
    $152 = ($143|0)==($141|0);
    if ($152) {
     $153 = 1 << $138;
     $154 = $153 ^ -1;
     $155 = HEAP32[1078]|0;
     $156 = $155 & $154;
     HEAP32[1078] = $156;
     break;
    }
    $157 = ($143|0)==($145|0);
    if ($157) {
     $$pre443 = ((($143)) + 8|0);
     $$pre$phi444Z2D = $$pre443;
    } else {
     $158 = HEAP32[(4328)>>2]|0;
     $159 = ($158>>>0)>($143>>>0);
     if ($159) {
      _abort();
      // unreachable;
     }
     $160 = ((($143)) + 8|0);
     $161 = HEAP32[$160>>2]|0;
     $162 = ($161|0)==($10|0);
     if ($162) {
      $$pre$phi444Z2D = $160;
     } else {
      _abort();
      // unreachable;
     }
    }
    $163 = ((($141)) + 12|0);
    HEAP32[$163>>2] = $143;
    HEAP32[$$pre$phi444Z2D>>2] = $141;
   } else {
    $164 = ((($10)) + 24|0);
    $165 = HEAP32[$164>>2]|0;
    $166 = ((($10)) + 12|0);
    $167 = HEAP32[$166>>2]|0;
    $168 = ($167|0)==($10|0);
    do {
     if ($168) {
      $179 = ((($10)) + 16|0);
      $180 = ((($179)) + 4|0);
      $181 = HEAP32[$180>>2]|0;
      $182 = ($181|0)==(0|0);
      if ($182) {
       $183 = HEAP32[$179>>2]|0;
       $184 = ($183|0)==(0|0);
       if ($184) {
        $$3398 = 0;
        break;
       } else {
        $$1396$ph = $183;$$1400$ph = $179;
       }
      } else {
       $$1396$ph = $181;$$1400$ph = $180;
      }
      $$1396 = $$1396$ph;$$1400 = $$1400$ph;
      while(1) {
       $185 = ((($$1396)) + 20|0);
       $186 = HEAP32[$185>>2]|0;
       $187 = ($186|0)==(0|0);
       if ($187) {
        $188 = ((($$1396)) + 16|0);
        $189 = HEAP32[$188>>2]|0;
        $190 = ($189|0)==(0|0);
        if ($190) {
         break;
        } else {
         $$1396$be = $189;$$1400$be = $188;
        }
       } else {
        $$1396$be = $186;$$1400$be = $185;
       }
       $$1396 = $$1396$be;$$1400 = $$1400$be;
      }
      $191 = HEAP32[(4328)>>2]|0;
      $192 = ($191>>>0)>($$1400>>>0);
      if ($192) {
       _abort();
       // unreachable;
      } else {
       HEAP32[$$1400>>2] = 0;
       $$3398 = $$1396;
       break;
      }
     } else {
      $169 = ((($10)) + 8|0);
      $170 = HEAP32[$169>>2]|0;
      $171 = HEAP32[(4328)>>2]|0;
      $172 = ($171>>>0)>($170>>>0);
      if ($172) {
       _abort();
       // unreachable;
      }
      $173 = ((($170)) + 12|0);
      $174 = HEAP32[$173>>2]|0;
      $175 = ($174|0)==($10|0);
      if (!($175)) {
       _abort();
       // unreachable;
      }
      $176 = ((($167)) + 8|0);
      $177 = HEAP32[$176>>2]|0;
      $178 = ($177|0)==($10|0);
      if ($178) {
       HEAP32[$173>>2] = $167;
       HEAP32[$176>>2] = $170;
       $$3398 = $167;
       break;
      } else {
       _abort();
       // unreachable;
      }
     }
    } while(0);
    $193 = ($165|0)==(0|0);
    if (!($193)) {
     $194 = ((($10)) + 28|0);
     $195 = HEAP32[$194>>2]|0;
     $196 = (4616 + ($195<<2)|0);
     $197 = HEAP32[$196>>2]|0;
     $198 = ($197|0)==($10|0);
     do {
      if ($198) {
       HEAP32[$196>>2] = $$3398;
       $cond420 = ($$3398|0)==(0|0);
       if ($cond420) {
        $199 = 1 << $195;
        $200 = $199 ^ -1;
        $201 = HEAP32[(4316)>>2]|0;
        $202 = $201 & $200;
        HEAP32[(4316)>>2] = $202;
        break L111;
       }
      } else {
       $203 = HEAP32[(4328)>>2]|0;
       $204 = ($203>>>0)>($165>>>0);
       if ($204) {
        _abort();
        // unreachable;
       } else {
        $205 = ((($165)) + 16|0);
        $206 = HEAP32[$205>>2]|0;
        $207 = ($206|0)==($10|0);
        $208 = ((($165)) + 20|0);
        $$sink456 = $207 ? $205 : $208;
        HEAP32[$$sink456>>2] = $$3398;
        $209 = ($$3398|0)==(0|0);
        if ($209) {
         break L111;
        } else {
         break;
        }
       }
      }
     } while(0);
     $210 = HEAP32[(4328)>>2]|0;
     $211 = ($210>>>0)>($$3398>>>0);
     if ($211) {
      _abort();
      // unreachable;
     }
     $212 = ((($$3398)) + 24|0);
     HEAP32[$212>>2] = $165;
     $213 = ((($10)) + 16|0);
     $214 = HEAP32[$213>>2]|0;
     $215 = ($214|0)==(0|0);
     do {
      if (!($215)) {
       $216 = ($210>>>0)>($214>>>0);
       if ($216) {
        _abort();
        // unreachable;
       } else {
        $217 = ((($$3398)) + 16|0);
        HEAP32[$217>>2] = $214;
        $218 = ((($214)) + 24|0);
        HEAP32[$218>>2] = $$3398;
        break;
       }
      }
     } while(0);
     $219 = ((($213)) + 4|0);
     $220 = HEAP32[$219>>2]|0;
     $221 = ($220|0)==(0|0);
     if (!($221)) {
      $222 = HEAP32[(4328)>>2]|0;
      $223 = ($222>>>0)>($220>>>0);
      if ($223) {
       _abort();
       // unreachable;
      } else {
       $224 = ((($$3398)) + 20|0);
       HEAP32[$224>>2] = $220;
       $225 = ((($220)) + 24|0);
       HEAP32[$225>>2] = $$3398;
       break;
      }
     }
    }
   }
  } while(0);
  $226 = $137 | 1;
  $227 = ((($$1)) + 4|0);
  HEAP32[$227>>2] = $226;
  $228 = (($113) + ($137)|0);
  HEAP32[$228>>2] = $137;
  $229 = HEAP32[(4332)>>2]|0;
  $230 = ($$1|0)==($229|0);
  if ($230) {
   HEAP32[(4320)>>2] = $137;
   return;
  } else {
   $$2 = $137;
  }
 } else {
  $231 = $116 & -2;
  HEAP32[$115>>2] = $231;
  $232 = $$1380 | 1;
  $233 = ((($$1)) + 4|0);
  HEAP32[$233>>2] = $232;
  $234 = (($113) + ($$1380)|0);
  HEAP32[$234>>2] = $$1380;
  $$2 = $$1380;
 }
 $235 = $$2 >>> 3;
 $236 = ($$2>>>0)<(256);
 if ($236) {
  $237 = $235 << 1;
  $238 = (4352 + ($237<<2)|0);
  $239 = HEAP32[1078]|0;
  $240 = 1 << $235;
  $241 = $239 & $240;
  $242 = ($241|0)==(0);
  if ($242) {
   $243 = $239 | $240;
   HEAP32[1078] = $243;
   $$pre = ((($238)) + 8|0);
   $$0401 = $238;$$pre$phiZ2D = $$pre;
  } else {
   $244 = ((($238)) + 8|0);
   $245 = HEAP32[$244>>2]|0;
   $246 = HEAP32[(4328)>>2]|0;
   $247 = ($246>>>0)>($245>>>0);
   if ($247) {
    _abort();
    // unreachable;
   } else {
    $$0401 = $245;$$pre$phiZ2D = $244;
   }
  }
  HEAP32[$$pre$phiZ2D>>2] = $$1;
  $248 = ((($$0401)) + 12|0);
  HEAP32[$248>>2] = $$1;
  $249 = ((($$1)) + 8|0);
  HEAP32[$249>>2] = $$0401;
  $250 = ((($$1)) + 12|0);
  HEAP32[$250>>2] = $238;
  return;
 }
 $251 = $$2 >>> 8;
 $252 = ($251|0)==(0);
 if ($252) {
  $$0394 = 0;
 } else {
  $253 = ($$2>>>0)>(16777215);
  if ($253) {
   $$0394 = 31;
  } else {
   $254 = (($251) + 1048320)|0;
   $255 = $254 >>> 16;
   $256 = $255 & 8;
   $257 = $251 << $256;
   $258 = (($257) + 520192)|0;
   $259 = $258 >>> 16;
   $260 = $259 & 4;
   $261 = $260 | $256;
   $262 = $257 << $260;
   $263 = (($262) + 245760)|0;
   $264 = $263 >>> 16;
   $265 = $264 & 2;
   $266 = $261 | $265;
   $267 = (14 - ($266))|0;
   $268 = $262 << $265;
   $269 = $268 >>> 15;
   $270 = (($267) + ($269))|0;
   $271 = $270 << 1;
   $272 = (($270) + 7)|0;
   $273 = $$2 >>> $272;
   $274 = $273 & 1;
   $275 = $274 | $271;
   $$0394 = $275;
  }
 }
 $276 = (4616 + ($$0394<<2)|0);
 $277 = ((($$1)) + 28|0);
 HEAP32[$277>>2] = $$0394;
 $278 = ((($$1)) + 16|0);
 $279 = ((($$1)) + 20|0);
 HEAP32[$279>>2] = 0;
 HEAP32[$278>>2] = 0;
 $280 = HEAP32[(4316)>>2]|0;
 $281 = 1 << $$0394;
 $282 = $280 & $281;
 $283 = ($282|0)==(0);
 L197: do {
  if ($283) {
   $284 = $280 | $281;
   HEAP32[(4316)>>2] = $284;
   HEAP32[$276>>2] = $$1;
   $285 = ((($$1)) + 24|0);
   HEAP32[$285>>2] = $276;
   $286 = ((($$1)) + 12|0);
   HEAP32[$286>>2] = $$1;
   $287 = ((($$1)) + 8|0);
   HEAP32[$287>>2] = $$1;
  } else {
   $288 = HEAP32[$276>>2]|0;
   $289 = ((($288)) + 4|0);
   $290 = HEAP32[$289>>2]|0;
   $291 = $290 & -8;
   $292 = ($291|0)==($$2|0);
   L200: do {
    if ($292) {
     $$0382$lcssa = $288;
    } else {
     $293 = ($$0394|0)==(31);
     $294 = $$0394 >>> 1;
     $295 = (25 - ($294))|0;
     $296 = $293 ? 0 : $295;
     $297 = $$2 << $296;
     $$0381438 = $297;$$0382437 = $288;
     while(1) {
      $304 = $$0381438 >>> 31;
      $305 = (((($$0382437)) + 16|0) + ($304<<2)|0);
      $300 = HEAP32[$305>>2]|0;
      $306 = ($300|0)==(0|0);
      if ($306) {
       break;
      }
      $298 = $$0381438 << 1;
      $299 = ((($300)) + 4|0);
      $301 = HEAP32[$299>>2]|0;
      $302 = $301 & -8;
      $303 = ($302|0)==($$2|0);
      if ($303) {
       $$0382$lcssa = $300;
       break L200;
      } else {
       $$0381438 = $298;$$0382437 = $300;
      }
     }
     $307 = HEAP32[(4328)>>2]|0;
     $308 = ($307>>>0)>($305>>>0);
     if ($308) {
      _abort();
      // unreachable;
     } else {
      HEAP32[$305>>2] = $$1;
      $309 = ((($$1)) + 24|0);
      HEAP32[$309>>2] = $$0382437;
      $310 = ((($$1)) + 12|0);
      HEAP32[$310>>2] = $$1;
      $311 = ((($$1)) + 8|0);
      HEAP32[$311>>2] = $$1;
      break L197;
     }
    }
   } while(0);
   $312 = ((($$0382$lcssa)) + 8|0);
   $313 = HEAP32[$312>>2]|0;
   $314 = HEAP32[(4328)>>2]|0;
   $315 = ($314>>>0)<=($$0382$lcssa>>>0);
   $316 = ($314>>>0)<=($313>>>0);
   $317 = $316 & $315;
   if ($317) {
    $318 = ((($313)) + 12|0);
    HEAP32[$318>>2] = $$1;
    HEAP32[$312>>2] = $$1;
    $319 = ((($$1)) + 8|0);
    HEAP32[$319>>2] = $313;
    $320 = ((($$1)) + 12|0);
    HEAP32[$320>>2] = $$0382$lcssa;
    $321 = ((($$1)) + 24|0);
    HEAP32[$321>>2] = 0;
    break;
   } else {
    _abort();
    // unreachable;
   }
  }
 } while(0);
 $322 = HEAP32[(4344)>>2]|0;
 $323 = (($322) + -1)|0;
 HEAP32[(4344)>>2] = $323;
 $324 = ($323|0)==(0);
 if (!($324)) {
  return;
 }
 $$0211$in$i = (4768);
 while(1) {
  $$0211$i = HEAP32[$$0211$in$i>>2]|0;
  $325 = ($$0211$i|0)==(0|0);
  $326 = ((($$0211$i)) + 8|0);
  if ($325) {
   break;
  } else {
   $$0211$in$i = $326;
  }
 }
 HEAP32[(4344)>>2] = -1;
 return;
}
function ___stdio_close($0) {
 $0 = $0|0;
 var $1 = 0, $2 = 0, $3 = 0, $4 = 0, $5 = 0, $vararg_buffer = 0, label = 0, sp = 0;
 sp = STACKTOP;
 STACKTOP = STACKTOP + 16|0; if ((STACKTOP|0) >= (STACK_MAX|0)) abortStackOverflow(16|0);
 $vararg_buffer = sp;
 $1 = ((($0)) + 60|0);
 $2 = HEAP32[$1>>2]|0;
 $3 = (_dummy_569($2)|0);
 HEAP32[$vararg_buffer>>2] = $3;
 $4 = (___syscall6(6,($vararg_buffer|0))|0);
 $5 = (___syscall_ret($4)|0);
 STACKTOP = sp;return ($5|0);
}
function ___stdio_write($0,$1,$2) {
 $0 = $0|0;
 $1 = $1|0;
 $2 = $2|0;
 var $$0 = 0, $$04756 = 0, $$04855 = 0, $$04954 = 0, $$051 = 0, $$1 = 0, $$150 = 0, $10 = 0, $11 = 0, $12 = 0, $13 = 0, $14 = 0, $15 = 0, $16 = 0, $17 = 0, $18 = 0, $19 = 0, $20 = 0, $21 = 0, $22 = 0;
 var $23 = 0, $24 = 0, $25 = 0, $26 = 0, $27 = 0, $28 = 0, $29 = 0, $3 = 0, $30 = 0, $31 = 0, $32 = 0, $33 = 0, $34 = 0, $35 = 0, $36 = 0, $37 = 0, $38 = 0, $39 = 0, $4 = 0, $40 = 0;
 var $41 = 0, $42 = 0, $43 = 0, $44 = 0, $45 = 0, $46 = 0, $47 = 0, $48 = 0, $49 = 0, $5 = 0, $50 = 0, $51 = 0, $6 = 0, $7 = 0, $8 = 0, $9 = 0, $vararg_buffer = 0, $vararg_buffer3 = 0, $vararg_ptr1 = 0, $vararg_ptr2 = 0;
 var $vararg_ptr6 = 0, $vararg_ptr7 = 0, label = 0, sp = 0;
 sp = STACKTOP;
 STACKTOP = STACKTOP + 48|0; if ((STACKTOP|0) >= (STACK_MAX|0)) abortStackOverflow(48|0);
 $vararg_buffer3 = sp + 16|0;
 $vararg_buffer = sp;
 $3 = sp + 32|0;
 $4 = ((($0)) + 28|0);
 $5 = HEAP32[$4>>2]|0;
 HEAP32[$3>>2] = $5;
 $6 = ((($3)) + 4|0);
 $7 = ((($0)) + 20|0);
 $8 = HEAP32[$7>>2]|0;
 $9 = (($8) - ($5))|0;
 HEAP32[$6>>2] = $9;
 $10 = ((($3)) + 8|0);
 HEAP32[$10>>2] = $1;
 $11 = ((($3)) + 12|0);
 HEAP32[$11>>2] = $2;
 $12 = (($9) + ($2))|0;
 $13 = ((($0)) + 60|0);
 $14 = HEAP32[$13>>2]|0;
 $15 = $3;
 HEAP32[$vararg_buffer>>2] = $14;
 $vararg_ptr1 = ((($vararg_buffer)) + 4|0);
 HEAP32[$vararg_ptr1>>2] = $15;
 $vararg_ptr2 = ((($vararg_buffer)) + 8|0);
 HEAP32[$vararg_ptr2>>2] = 2;
 $16 = (___syscall146(146,($vararg_buffer|0))|0);
 $17 = (___syscall_ret($16)|0);
 $18 = ($12|0)==($17|0);
 L1: do {
  if ($18) {
   label = 3;
  } else {
   $$04756 = 2;$$04855 = $12;$$04954 = $3;$26 = $17;
   while(1) {
    $27 = ($26|0)<(0);
    if ($27) {
     break;
    }
    $35 = (($$04855) - ($26))|0;
    $36 = ((($$04954)) + 4|0);
    $37 = HEAP32[$36>>2]|0;
    $38 = ($26>>>0)>($37>>>0);
    $39 = ((($$04954)) + 8|0);
    $$150 = $38 ? $39 : $$04954;
    $40 = $38 << 31 >> 31;
    $$1 = (($$04756) + ($40))|0;
    $41 = $38 ? $37 : 0;
    $$0 = (($26) - ($41))|0;
    $42 = HEAP32[$$150>>2]|0;
    $43 = (($42) + ($$0)|0);
    HEAP32[$$150>>2] = $43;
    $44 = ((($$150)) + 4|0);
    $45 = HEAP32[$44>>2]|0;
    $46 = (($45) - ($$0))|0;
    HEAP32[$44>>2] = $46;
    $47 = HEAP32[$13>>2]|0;
    $48 = $$150;
    HEAP32[$vararg_buffer3>>2] = $47;
    $vararg_ptr6 = ((($vararg_buffer3)) + 4|0);
    HEAP32[$vararg_ptr6>>2] = $48;
    $vararg_ptr7 = ((($vararg_buffer3)) + 8|0);
    HEAP32[$vararg_ptr7>>2] = $$1;
    $49 = (___syscall146(146,($vararg_buffer3|0))|0);
    $50 = (___syscall_ret($49)|0);
    $51 = ($35|0)==($50|0);
    if ($51) {
     label = 3;
     break L1;
    } else {
     $$04756 = $$1;$$04855 = $35;$$04954 = $$150;$26 = $50;
    }
   }
   $28 = ((($0)) + 16|0);
   HEAP32[$28>>2] = 0;
   HEAP32[$4>>2] = 0;
   HEAP32[$7>>2] = 0;
   $29 = HEAP32[$0>>2]|0;
   $30 = $29 | 32;
   HEAP32[$0>>2] = $30;
   $31 = ($$04756|0)==(2);
   if ($31) {
    $$051 = 0;
   } else {
    $32 = ((($$04954)) + 4|0);
    $33 = HEAP32[$32>>2]|0;
    $34 = (($2) - ($33))|0;
    $$051 = $34;
   }
  }
 } while(0);
 if ((label|0) == 3) {
  $19 = ((($0)) + 44|0);
  $20 = HEAP32[$19>>2]|0;
  $21 = ((($0)) + 48|0);
  $22 = HEAP32[$21>>2]|0;
  $23 = (($20) + ($22)|0);
  $24 = ((($0)) + 16|0);
  HEAP32[$24>>2] = $23;
  $25 = $20;
  HEAP32[$4>>2] = $25;
  HEAP32[$7>>2] = $25;
  $$051 = $2;
 }
 STACKTOP = sp;return ($$051|0);
}
function ___stdio_seek($0,$1,$2) {
 $0 = $0|0;
 $1 = $1|0;
 $2 = $2|0;
 var $$pre = 0, $10 = 0, $3 = 0, $4 = 0, $5 = 0, $6 = 0, $7 = 0, $8 = 0, $9 = 0, $vararg_buffer = 0, $vararg_ptr1 = 0, $vararg_ptr2 = 0, $vararg_ptr3 = 0, $vararg_ptr4 = 0, label = 0, sp = 0;
 sp = STACKTOP;
 STACKTOP = STACKTOP + 32|0; if ((STACKTOP|0) >= (STACK_MAX|0)) abortStackOverflow(32|0);
 $vararg_buffer = sp;
 $3 = sp + 20|0;
 $4 = ((($0)) + 60|0);
 $5 = HEAP32[$4>>2]|0;
 $6 = $3;
 HEAP32[$vararg_buffer>>2] = $5;
 $vararg_ptr1 = ((($vararg_buffer)) + 4|0);
 HEAP32[$vararg_ptr1>>2] = 0;
 $vararg_ptr2 = ((($vararg_buffer)) + 8|0);
 HEAP32[$vararg_ptr2>>2] = $1;
 $vararg_ptr3 = ((($vararg_buffer)) + 12|0);
 HEAP32[$vararg_ptr3>>2] = $6;
 $vararg_ptr4 = ((($vararg_buffer)) + 16|0);
 HEAP32[$vararg_ptr4>>2] = $2;
 $7 = (___syscall140(140,($vararg_buffer|0))|0);
 $8 = (___syscall_ret($7)|0);
 $9 = ($8|0)<(0);
 if ($9) {
  HEAP32[$3>>2] = -1;
  $10 = -1;
 } else {
  $$pre = HEAP32[$3>>2]|0;
  $10 = $$pre;
 }
 STACKTOP = sp;return ($10|0);
}
function ___syscall_ret($0) {
 $0 = $0|0;
 var $$0 = 0, $1 = 0, $2 = 0, $3 = 0, label = 0, sp = 0;
 sp = STACKTOP;
 $1 = ($0>>>0)>(4294963200);
 if ($1) {
  $2 = (0 - ($0))|0;
  $3 = (___errno_location()|0);
  HEAP32[$3>>2] = $2;
  $$0 = -1;
 } else {
  $$0 = $0;
 }
 return ($$0|0);
}
function ___errno_location() {
 var label = 0, sp = 0;
 sp = STACKTOP;
 return (4808|0);
}
function _dummy_569($0) {
 $0 = $0|0;
 var label = 0, sp = 0;
 sp = STACKTOP;
 return ($0|0);
}
function ___stdout_write($0,$1,$2) {
 $0 = $0|0;
 $1 = $1|0;
 $2 = $2|0;
 var $10 = 0, $11 = 0, $12 = 0, $13 = 0, $14 = 0, $3 = 0, $4 = 0, $5 = 0, $6 = 0, $7 = 0, $8 = 0, $9 = 0, $vararg_buffer = 0, $vararg_ptr1 = 0, $vararg_ptr2 = 0, label = 0, sp = 0;
 sp = STACKTOP;
 STACKTOP = STACKTOP + 32|0; if ((STACKTOP|0) >= (STACK_MAX|0)) abortStackOverflow(32|0);
 $vararg_buffer = sp;
 $3 = sp + 16|0;
 $4 = ((($0)) + 36|0);
 HEAP32[$4>>2] = 34;
 $5 = HEAP32[$0>>2]|0;
 $6 = $5 & 64;
 $7 = ($6|0)==(0);
 if ($7) {
  $8 = ((($0)) + 60|0);
  $9 = HEAP32[$8>>2]|0;
  $10 = $3;
  HEAP32[$vararg_buffer>>2] = $9;
  $vararg_ptr1 = ((($vararg_buffer)) + 4|0);
  HEAP32[$vararg_ptr1>>2] = 21523;
  $vararg_ptr2 = ((($vararg_buffer)) + 8|0);
  HEAP32[$vararg_ptr2>>2] = $10;
  $11 = (___syscall54(54,($vararg_buffer|0))|0);
  $12 = ($11|0)==(0);
  if (!($12)) {
   $13 = ((($0)) + 75|0);
   HEAP8[$13>>0] = -1;
  }
 }
 $14 = (___stdio_write($0,$1,$2)|0);
 STACKTOP = sp;return ($14|0);
}
function ___lockfile($0) {
 $0 = $0|0;
 var label = 0, sp = 0;
 sp = STACKTOP;
 return 0;
}
function ___unlockfile($0) {
 $0 = $0|0;
 var label = 0, sp = 0;
 sp = STACKTOP;
 return;
}
function _strlen($0) {
 $0 = $0|0;
 var $$0 = 0, $$014 = 0, $$015$lcssa = 0, $$01518 = 0, $$1$lcssa = 0, $$pn = 0, $$pn29 = 0, $$pre = 0, $1 = 0, $10 = 0, $11 = 0, $12 = 0, $13 = 0, $14 = 0, $15 = 0, $16 = 0, $17 = 0, $18 = 0, $19 = 0, $2 = 0;
 var $20 = 0, $21 = 0, $22 = 0, $3 = 0, $4 = 0, $5 = 0, $6 = 0, $7 = 0, $8 = 0, $9 = 0, label = 0, sp = 0;
 sp = STACKTOP;
 $1 = $0;
 $2 = $1 & 3;
 $3 = ($2|0)==(0);
 L1: do {
  if ($3) {
   $$015$lcssa = $0;
   label = 5;
  } else {
   $$01518 = $0;$22 = $1;
   while(1) {
    $4 = HEAP8[$$01518>>0]|0;
    $5 = ($4<<24>>24)==(0);
    if ($5) {
     $$pn = $22;
     break L1;
    }
    $6 = ((($$01518)) + 1|0);
    $7 = $6;
    $8 = $7 & 3;
    $9 = ($8|0)==(0);
    if ($9) {
     $$015$lcssa = $6;
     label = 5;
     break;
    } else {
     $$01518 = $6;$22 = $7;
    }
   }
  }
 } while(0);
 if ((label|0) == 5) {
  $$0 = $$015$lcssa;
  while(1) {
   $10 = HEAP32[$$0>>2]|0;
   $11 = (($10) + -16843009)|0;
   $12 = $10 & -2139062144;
   $13 = $12 ^ -2139062144;
   $14 = $13 & $11;
   $15 = ($14|0)==(0);
   $16 = ((($$0)) + 4|0);
   if ($15) {
    $$0 = $16;
   } else {
    break;
   }
  }
  $17 = $10&255;
  $18 = ($17<<24>>24)==(0);
  if ($18) {
   $$1$lcssa = $$0;
  } else {
   $$pn29 = $$0;
   while(1) {
    $19 = ((($$pn29)) + 1|0);
    $$pre = HEAP8[$19>>0]|0;
    $20 = ($$pre<<24>>24)==(0);
    if ($20) {
     $$1$lcssa = $19;
     break;
    } else {
     $$pn29 = $19;
    }
   }
  }
  $21 = $$1$lcssa;
  $$pn = $21;
 }
 $$014 = (($$pn) - ($1))|0;
 return ($$014|0);
}
function ___strdup($0) {
 $0 = $0|0;
 var $$0 = 0, $1 = 0, $2 = 0, $3 = 0, $4 = 0, $5 = 0, label = 0, sp = 0;
 sp = STACKTOP;
 $1 = (_strlen($0)|0);
 $2 = (($1) + 1)|0;
 $3 = (_malloc($2)|0);
 $4 = ($3|0)==(0|0);
 if ($4) {
  $$0 = 0;
 } else {
  $5 = (_memcpy(($3|0),($0|0),($2|0))|0);
  $$0 = $5;
 }
 return ($$0|0);
}
function ___ofl_lock() {
 var label = 0, sp = 0;
 sp = STACKTOP;
 ___lock((4812|0));
 return (4820|0);
}
function ___ofl_unlock() {
 var label = 0, sp = 0;
 sp = STACKTOP;
 ___unlock((4812|0));
 return;
}
function _fflush($0) {
 $0 = $0|0;
 var $$0 = 0, $$023 = 0, $$02325 = 0, $$02327 = 0, $$024$lcssa = 0, $$02426 = 0, $$1 = 0, $1 = 0, $10 = 0, $11 = 0, $12 = 0, $13 = 0, $14 = 0, $15 = 0, $16 = 0, $17 = 0, $18 = 0, $19 = 0, $2 = 0, $20 = 0;
 var $21 = 0, $22 = 0, $23 = 0, $24 = 0, $25 = 0, $26 = 0, $27 = 0, $28 = 0, $29 = 0, $3 = 0, $4 = 0, $5 = 0, $6 = 0, $7 = 0, $8 = 0, $9 = 0, $phitmp = 0, label = 0, sp = 0;
 sp = STACKTOP;
 $1 = ($0|0)==(0|0);
 do {
  if ($1) {
   $8 = HEAP32[171]|0;
   $9 = ($8|0)==(0|0);
   if ($9) {
    $29 = 0;
   } else {
    $10 = HEAP32[171]|0;
    $11 = (_fflush($10)|0);
    $29 = $11;
   }
   $12 = (___ofl_lock()|0);
   $$02325 = HEAP32[$12>>2]|0;
   $13 = ($$02325|0)==(0|0);
   if ($13) {
    $$024$lcssa = $29;
   } else {
    $$02327 = $$02325;$$02426 = $29;
    while(1) {
     $14 = ((($$02327)) + 76|0);
     $15 = HEAP32[$14>>2]|0;
     $16 = ($15|0)>(-1);
     if ($16) {
      $17 = (___lockfile($$02327)|0);
      $25 = $17;
     } else {
      $25 = 0;
     }
     $18 = ((($$02327)) + 20|0);
     $19 = HEAP32[$18>>2]|0;
     $20 = ((($$02327)) + 28|0);
     $21 = HEAP32[$20>>2]|0;
     $22 = ($19>>>0)>($21>>>0);
     if ($22) {
      $23 = (___fflush_unlocked($$02327)|0);
      $24 = $23 | $$02426;
      $$1 = $24;
     } else {
      $$1 = $$02426;
     }
     $26 = ($25|0)==(0);
     if (!($26)) {
      ___unlockfile($$02327);
     }
     $27 = ((($$02327)) + 56|0);
     $$023 = HEAP32[$27>>2]|0;
     $28 = ($$023|0)==(0|0);
     if ($28) {
      $$024$lcssa = $$1;
      break;
     } else {
      $$02327 = $$023;$$02426 = $$1;
     }
    }
   }
   ___ofl_unlock();
   $$0 = $$024$lcssa;
  } else {
   $2 = ((($0)) + 76|0);
   $3 = HEAP32[$2>>2]|0;
   $4 = ($3|0)>(-1);
   if (!($4)) {
    $5 = (___fflush_unlocked($0)|0);
    $$0 = $5;
    break;
   }
   $6 = (___lockfile($0)|0);
   $phitmp = ($6|0)==(0);
   $7 = (___fflush_unlocked($0)|0);
   if ($phitmp) {
    $$0 = $7;
   } else {
    ___unlockfile($0);
    $$0 = $7;
   }
  }
 } while(0);
 return ($$0|0);
}
function ___fflush_unlocked($0) {
 $0 = $0|0;
 var $$0 = 0, $1 = 0, $10 = 0, $11 = 0, $12 = 0, $13 = 0, $14 = 0, $15 = 0, $16 = 0, $17 = 0, $18 = 0, $19 = 0, $2 = 0, $20 = 0, $3 = 0, $4 = 0, $5 = 0, $6 = 0, $7 = 0, $8 = 0;
 var $9 = 0, label = 0, sp = 0;
 sp = STACKTOP;
 $1 = ((($0)) + 20|0);
 $2 = HEAP32[$1>>2]|0;
 $3 = ((($0)) + 28|0);
 $4 = HEAP32[$3>>2]|0;
 $5 = ($2>>>0)>($4>>>0);
 if ($5) {
  $6 = ((($0)) + 36|0);
  $7 = HEAP32[$6>>2]|0;
  (FUNCTION_TABLE_iiii[$7 & 63]($0,0,0)|0);
  $8 = HEAP32[$1>>2]|0;
  $9 = ($8|0)==(0|0);
  if ($9) {
   $$0 = -1;
  } else {
   label = 3;
  }
 } else {
  label = 3;
 }
 if ((label|0) == 3) {
  $10 = ((($0)) + 4|0);
  $11 = HEAP32[$10>>2]|0;
  $12 = ((($0)) + 8|0);
  $13 = HEAP32[$12>>2]|0;
  $14 = ($11>>>0)<($13>>>0);
  if ($14) {
   $15 = $11;
   $16 = $13;
   $17 = (($15) - ($16))|0;
   $18 = ((($0)) + 40|0);
   $19 = HEAP32[$18>>2]|0;
   (FUNCTION_TABLE_iiii[$19 & 63]($0,$17,1)|0);
  }
  $20 = ((($0)) + 16|0);
  HEAP32[$20>>2] = 0;
  HEAP32[$3>>2] = 0;
  HEAP32[$1>>2] = 0;
  HEAP32[$12>>2] = 0;
  HEAP32[$10>>2] = 0;
  $$0 = 0;
 }
 return ($$0|0);
}
function __Znwj($0) {
 $0 = $0|0;
 var $$lcssa = 0, $1 = 0, $2 = 0, $3 = 0, $4 = 0, $5 = 0, $spec$store$select = 0, label = 0, sp = 0;
 sp = STACKTOP;
 $1 = ($0|0)==(0);
 $spec$store$select = $1 ? 1 : $0;
 while(1) {
  $2 = (_malloc($spec$store$select)|0);
  $3 = ($2|0)==(0|0);
  if (!($3)) {
   $$lcssa = $2;
   break;
  }
  $4 = (__ZSt15get_new_handlerv()|0);
  $5 = ($4|0)==(0|0);
  if ($5) {
   $$lcssa = 0;
   break;
  }
  FUNCTION_TABLE_v[$4 & 0]();
 }
 return ($$lcssa|0);
}
function __ZdlPv($0) {
 $0 = $0|0;
 var label = 0, sp = 0;
 sp = STACKTOP;
 _free($0);
 return;
}
function __ZN10__cxxabiv116__shim_type_infoD2Ev($0) {
 $0 = $0|0;
 var label = 0, sp = 0;
 sp = STACKTOP;
 return;
}
function __ZN10__cxxabiv117__class_type_infoD0Ev($0) {
 $0 = $0|0;
 var label = 0, sp = 0;
 sp = STACKTOP;
 __ZN10__cxxabiv116__shim_type_infoD2Ev($0);
 __ZdlPv($0);
 return;
}
function __ZNK10__cxxabiv116__shim_type_info5noop1Ev($0) {
 $0 = $0|0;
 var label = 0, sp = 0;
 sp = STACKTOP;
 return;
}
function __ZNK10__cxxabiv116__shim_type_info5noop2Ev($0) {
 $0 = $0|0;
 var label = 0, sp = 0;
 sp = STACKTOP;
 return;
}
function __ZNK10__cxxabiv117__class_type_info9can_catchEPKNS_16__shim_type_infoERPv($0,$1,$2) {
 $0 = $0|0;
 $1 = $1|0;
 $2 = $2|0;
 var $$0 = 0, $$2 = 0, $10 = 0, $11 = 0, $12 = 0, $13 = 0, $14 = 0, $15 = 0, $16 = 0, $17 = 0, $18 = 0, $19 = 0, $20 = 0, $3 = 0, $4 = 0, $5 = 0, $6 = 0, $7 = 0, $8 = 0, $9 = 0;
 var dest = 0, label = 0, sp = 0, stop = 0;
 sp = STACKTOP;
 STACKTOP = STACKTOP + 64|0; if ((STACKTOP|0) >= (STACK_MAX|0)) abortStackOverflow(64|0);
 $3 = sp;
 $4 = (__ZN10__cxxabiv18is_equalEPKSt9type_infoS2_b($0,$1,0)|0);
 if ($4) {
  $$2 = 1;
 } else {
  $5 = ($1|0)==(0|0);
  if ($5) {
   $$2 = 0;
  } else {
   $6 = (___dynamic_cast($1,248,232,0)|0);
   $7 = ($6|0)==(0|0);
   if ($7) {
    $$2 = 0;
   } else {
    $8 = ((($3)) + 4|0);
    dest=$8; stop=dest+52|0; do { HEAP32[dest>>2]=0|0; dest=dest+4|0; } while ((dest|0) < (stop|0));
    HEAP32[$3>>2] = $6;
    $9 = ((($3)) + 8|0);
    HEAP32[$9>>2] = $0;
    $10 = ((($3)) + 12|0);
    HEAP32[$10>>2] = -1;
    $11 = ((($3)) + 48|0);
    HEAP32[$11>>2] = 1;
    $12 = HEAP32[$6>>2]|0;
    $13 = ((($12)) + 28|0);
    $14 = HEAP32[$13>>2]|0;
    $15 = HEAP32[$2>>2]|0;
    FUNCTION_TABLE_viiii[$14 & 31]($6,$3,$15,1);
    $16 = ((($3)) + 24|0);
    $17 = HEAP32[$16>>2]|0;
    $18 = ($17|0)==(1);
    if ($18) {
     $19 = ((($3)) + 16|0);
     $20 = HEAP32[$19>>2]|0;
     HEAP32[$2>>2] = $20;
     $$0 = 1;
    } else {
     $$0 = 0;
    }
    $$2 = $$0;
   }
  }
 }
 STACKTOP = sp;return ($$2|0);
}
function __ZNK10__cxxabiv117__class_type_info16search_above_dstEPNS_19__dynamic_cast_infoEPKvS4_ib($0,$1,$2,$3,$4,$5) {
 $0 = $0|0;
 $1 = $1|0;
 $2 = $2|0;
 $3 = $3|0;
 $4 = $4|0;
 $5 = $5|0;
 var $6 = 0, $7 = 0, $8 = 0, label = 0, sp = 0;
 sp = STACKTOP;
 $6 = ((($1)) + 8|0);
 $7 = HEAP32[$6>>2]|0;
 $8 = (__ZN10__cxxabiv18is_equalEPKSt9type_infoS2_b($0,$7,$5)|0);
 if ($8) {
  __ZNK10__cxxabiv117__class_type_info29process_static_type_above_dstEPNS_19__dynamic_cast_infoEPKvS4_i(0,$1,$2,$3,$4);
 }
 return;
}
function __ZNK10__cxxabiv117__class_type_info16search_below_dstEPNS_19__dynamic_cast_infoEPKvib($0,$1,$2,$3,$4) {
 $0 = $0|0;
 $1 = $1|0;
 $2 = $2|0;
 $3 = $3|0;
 $4 = $4|0;
 var $10 = 0, $11 = 0, $12 = 0, $13 = 0, $14 = 0, $15 = 0, $16 = 0, $17 = 0, $18 = 0, $19 = 0, $20 = 0, $21 = 0, $22 = 0, $23 = 0, $24 = 0, $25 = 0, $26 = 0, $27 = 0, $28 = 0, $29 = 0;
 var $5 = 0, $6 = 0, $7 = 0, $8 = 0, $9 = 0, label = 0, sp = 0;
 sp = STACKTOP;
 $5 = ((($1)) + 8|0);
 $6 = HEAP32[$5>>2]|0;
 $7 = (__ZN10__cxxabiv18is_equalEPKSt9type_infoS2_b($0,$6,$4)|0);
 do {
  if ($7) {
   __ZNK10__cxxabiv117__class_type_info29process_static_type_below_dstEPNS_19__dynamic_cast_infoEPKvi(0,$1,$2,$3);
  } else {
   $8 = HEAP32[$1>>2]|0;
   $9 = (__ZN10__cxxabiv18is_equalEPKSt9type_infoS2_b($0,$8,$4)|0);
   if ($9) {
    $10 = ((($1)) + 16|0);
    $11 = HEAP32[$10>>2]|0;
    $12 = ($11|0)==($2|0);
    if (!($12)) {
     $13 = ((($1)) + 20|0);
     $14 = HEAP32[$13>>2]|0;
     $15 = ($14|0)==($2|0);
     if (!($15)) {
      $18 = ((($1)) + 32|0);
      HEAP32[$18>>2] = $3;
      HEAP32[$13>>2] = $2;
      $19 = ((($1)) + 40|0);
      $20 = HEAP32[$19>>2]|0;
      $21 = (($20) + 1)|0;
      HEAP32[$19>>2] = $21;
      $22 = ((($1)) + 36|0);
      $23 = HEAP32[$22>>2]|0;
      $24 = ($23|0)==(1);
      if ($24) {
       $25 = ((($1)) + 24|0);
       $26 = HEAP32[$25>>2]|0;
       $27 = ($26|0)==(2);
       if ($27) {
        $28 = ((($1)) + 54|0);
        HEAP8[$28>>0] = 1;
       }
      }
      $29 = ((($1)) + 44|0);
      HEAP32[$29>>2] = 4;
      break;
     }
    }
    $16 = ($3|0)==(1);
    if ($16) {
     $17 = ((($1)) + 32|0);
     HEAP32[$17>>2] = 1;
    }
   }
  }
 } while(0);
 return;
}
function __ZNK10__cxxabiv117__class_type_info27has_unambiguous_public_baseEPNS_19__dynamic_cast_infoEPvi($0,$1,$2,$3) {
 $0 = $0|0;
 $1 = $1|0;
 $2 = $2|0;
 $3 = $3|0;
 var $4 = 0, $5 = 0, $6 = 0, label = 0, sp = 0;
 sp = STACKTOP;
 $4 = ((($1)) + 8|0);
 $5 = HEAP32[$4>>2]|0;
 $6 = (__ZN10__cxxabiv18is_equalEPKSt9type_infoS2_b($0,$5,0)|0);
 if ($6) {
  __ZNK10__cxxabiv117__class_type_info24process_found_base_classEPNS_19__dynamic_cast_infoEPvi(0,$1,$2,$3);
 }
 return;
}
function __ZN10__cxxabiv18is_equalEPKSt9type_infoS2_b($0,$1,$2) {
 $0 = $0|0;
 $1 = $1|0;
 $2 = $2|0;
 var $3 = 0, label = 0, sp = 0;
 sp = STACKTOP;
 $3 = ($0|0)==($1|0);
 return ($3|0);
}
function __ZNK10__cxxabiv117__class_type_info24process_found_base_classEPNS_19__dynamic_cast_infoEPvi($0,$1,$2,$3) {
 $0 = $0|0;
 $1 = $1|0;
 $2 = $2|0;
 $3 = $3|0;
 var $10 = 0, $11 = 0, $12 = 0, $13 = 0, $14 = 0, $15 = 0, $16 = 0, $17 = 0, $4 = 0, $5 = 0, $6 = 0, $7 = 0, $8 = 0, $9 = 0, label = 0, sp = 0;
 sp = STACKTOP;
 $4 = ((($1)) + 16|0);
 $5 = HEAP32[$4>>2]|0;
 $6 = ($5|0)==(0|0);
 do {
  if ($6) {
   HEAP32[$4>>2] = $2;
   $7 = ((($1)) + 24|0);
   HEAP32[$7>>2] = $3;
   $8 = ((($1)) + 36|0);
   HEAP32[$8>>2] = 1;
  } else {
   $9 = ($5|0)==($2|0);
   if (!($9)) {
    $13 = ((($1)) + 36|0);
    $14 = HEAP32[$13>>2]|0;
    $15 = (($14) + 1)|0;
    HEAP32[$13>>2] = $15;
    $16 = ((($1)) + 24|0);
    HEAP32[$16>>2] = 2;
    $17 = ((($1)) + 54|0);
    HEAP8[$17>>0] = 1;
    break;
   }
   $10 = ((($1)) + 24|0);
   $11 = HEAP32[$10>>2]|0;
   $12 = ($11|0)==(2);
   if ($12) {
    HEAP32[$10>>2] = $3;
   }
  }
 } while(0);
 return;
}
function __ZNK10__cxxabiv117__class_type_info29process_static_type_below_dstEPNS_19__dynamic_cast_infoEPKvi($0,$1,$2,$3) {
 $0 = $0|0;
 $1 = $1|0;
 $2 = $2|0;
 $3 = $3|0;
 var $4 = 0, $5 = 0, $6 = 0, $7 = 0, $8 = 0, $9 = 0, label = 0, sp = 0;
 sp = STACKTOP;
 $4 = ((($1)) + 4|0);
 $5 = HEAP32[$4>>2]|0;
 $6 = ($5|0)==($2|0);
 if ($6) {
  $7 = ((($1)) + 28|0);
  $8 = HEAP32[$7>>2]|0;
  $9 = ($8|0)==(1);
  if (!($9)) {
   HEAP32[$7>>2] = $3;
  }
 }
 return;
}
function __ZNK10__cxxabiv117__class_type_info29process_static_type_above_dstEPNS_19__dynamic_cast_infoEPKvS4_i($0,$1,$2,$3,$4) {
 $0 = $0|0;
 $1 = $1|0;
 $2 = $2|0;
 $3 = $3|0;
 $4 = $4|0;
 var $10 = 0, $11 = 0, $12 = 0, $13 = 0, $14 = 0, $15 = 0, $16 = 0, $17 = 0, $18 = 0, $19 = 0, $20 = 0, $21 = 0, $22 = 0, $23 = 0, $24 = 0, $25 = 0, $26 = 0, $27 = 0, $28 = 0, $29 = 0;
 var $30 = 0, $31 = 0, $32 = 0, $33 = 0, $5 = 0, $6 = 0, $7 = 0, $8 = 0, $9 = 0, $or$cond = 0, $or$cond22 = 0, label = 0, sp = 0;
 sp = STACKTOP;
 $5 = ((($1)) + 53|0);
 HEAP8[$5>>0] = 1;
 $6 = ((($1)) + 4|0);
 $7 = HEAP32[$6>>2]|0;
 $8 = ($7|0)==($3|0);
 do {
  if ($8) {
   $9 = ((($1)) + 52|0);
   HEAP8[$9>>0] = 1;
   $10 = ((($1)) + 16|0);
   $11 = HEAP32[$10>>2]|0;
   $12 = ($11|0)==(0|0);
   if ($12) {
    HEAP32[$10>>2] = $2;
    $13 = ((($1)) + 24|0);
    HEAP32[$13>>2] = $4;
    $14 = ((($1)) + 36|0);
    HEAP32[$14>>2] = 1;
    $15 = ((($1)) + 48|0);
    $16 = HEAP32[$15>>2]|0;
    $17 = ($16|0)==(1);
    $18 = ($4|0)==(1);
    $or$cond = $18 & $17;
    if (!($or$cond)) {
     break;
    }
    $19 = ((($1)) + 54|0);
    HEAP8[$19>>0] = 1;
    break;
   }
   $20 = ($11|0)==($2|0);
   if (!($20)) {
    $30 = ((($1)) + 36|0);
    $31 = HEAP32[$30>>2]|0;
    $32 = (($31) + 1)|0;
    HEAP32[$30>>2] = $32;
    $33 = ((($1)) + 54|0);
    HEAP8[$33>>0] = 1;
    break;
   }
   $21 = ((($1)) + 24|0);
   $22 = HEAP32[$21>>2]|0;
   $23 = ($22|0)==(2);
   if ($23) {
    HEAP32[$21>>2] = $4;
    $27 = $4;
   } else {
    $27 = $22;
   }
   $24 = ((($1)) + 48|0);
   $25 = HEAP32[$24>>2]|0;
   $26 = ($25|0)==(1);
   $28 = ($27|0)==(1);
   $or$cond22 = $26 & $28;
   if ($or$cond22) {
    $29 = ((($1)) + 54|0);
    HEAP8[$29>>0] = 1;
   }
  }
 } while(0);
 return;
}
function ___dynamic_cast($0,$1,$2,$3) {
 $0 = $0|0;
 $1 = $1|0;
 $2 = $2|0;
 $3 = $3|0;
 var $$0 = 0, $10 = 0, $11 = 0, $12 = 0, $13 = 0, $14 = 0, $15 = 0, $16 = 0, $17 = 0, $18 = 0, $19 = 0, $20 = 0, $21 = 0, $22 = 0, $23 = 0, $24 = 0, $25 = 0, $26 = 0, $27 = 0, $28 = 0;
 var $29 = 0, $30 = 0, $31 = 0, $32 = 0, $33 = 0, $34 = 0, $35 = 0, $36 = 0, $37 = 0, $38 = 0, $39 = 0, $4 = 0, $40 = 0, $41 = 0, $42 = 0, $43 = 0, $44 = 0, $45 = 0, $46 = 0, $47 = 0;
 var $5 = 0, $6 = 0, $7 = 0, $8 = 0, $9 = 0, $or$cond = 0, $or$cond28 = 0, $or$cond30 = 0, $or$cond32 = 0, $spec$select = 0, $spec$select33 = 0, dest = 0, label = 0, sp = 0, stop = 0;
 sp = STACKTOP;
 STACKTOP = STACKTOP + 64|0; if ((STACKTOP|0) >= (STACK_MAX|0)) abortStackOverflow(64|0);
 $4 = sp;
 $5 = HEAP32[$0>>2]|0;
 $6 = ((($5)) + -8|0);
 $7 = HEAP32[$6>>2]|0;
 $8 = (($0) + ($7)|0);
 $9 = ((($5)) + -4|0);
 $10 = HEAP32[$9>>2]|0;
 HEAP32[$4>>2] = $2;
 $11 = ((($4)) + 4|0);
 HEAP32[$11>>2] = $0;
 $12 = ((($4)) + 8|0);
 HEAP32[$12>>2] = $1;
 $13 = ((($4)) + 12|0);
 HEAP32[$13>>2] = $3;
 $14 = ((($4)) + 16|0);
 $15 = ((($4)) + 20|0);
 $16 = ((($4)) + 24|0);
 $17 = ((($4)) + 28|0);
 $18 = ((($4)) + 32|0);
 $19 = ((($4)) + 40|0);
 dest=$14; stop=dest+36|0; do { HEAP32[dest>>2]=0|0; dest=dest+4|0; } while ((dest|0) < (stop|0));HEAP16[$14+36>>1]=0|0;HEAP8[$14+38>>0]=0|0;
 $20 = (__ZN10__cxxabiv18is_equalEPKSt9type_infoS2_b($10,$2,0)|0);
 L1: do {
  if ($20) {
   $21 = ((($4)) + 48|0);
   HEAP32[$21>>2] = 1;
   $22 = HEAP32[$10>>2]|0;
   $23 = ((($22)) + 20|0);
   $24 = HEAP32[$23>>2]|0;
   FUNCTION_TABLE_viiiiii[$24 & 31]($10,$4,$8,$8,1,0);
   $25 = HEAP32[$16>>2]|0;
   $26 = ($25|0)==(1);
   $spec$select = $26 ? $8 : 0;
   $$0 = $spec$select;
  } else {
   $27 = ((($4)) + 36|0);
   $28 = HEAP32[$10>>2]|0;
   $29 = ((($28)) + 24|0);
   $30 = HEAP32[$29>>2]|0;
   FUNCTION_TABLE_viiiii[$30 & 31]($10,$4,$8,1,0);
   $31 = HEAP32[$27>>2]|0;
   switch ($31|0) {
   case 0:  {
    $32 = HEAP32[$19>>2]|0;
    $33 = ($32|0)==(1);
    $34 = HEAP32[$17>>2]|0;
    $35 = ($34|0)==(1);
    $or$cond = $33 & $35;
    $36 = HEAP32[$18>>2]|0;
    $37 = ($36|0)==(1);
    $or$cond28 = $or$cond & $37;
    $38 = HEAP32[$15>>2]|0;
    $spec$select33 = $or$cond28 ? $38 : 0;
    $$0 = $spec$select33;
    break L1;
    break;
   }
   case 1:  {
    break;
   }
   default: {
    $$0 = 0;
    break L1;
   }
   }
   $39 = HEAP32[$16>>2]|0;
   $40 = ($39|0)==(1);
   if (!($40)) {
    $41 = HEAP32[$19>>2]|0;
    $42 = ($41|0)==(0);
    $43 = HEAP32[$17>>2]|0;
    $44 = ($43|0)==(1);
    $or$cond30 = $42 & $44;
    $45 = HEAP32[$18>>2]|0;
    $46 = ($45|0)==(1);
    $or$cond32 = $or$cond30 & $46;
    if (!($or$cond32)) {
     $$0 = 0;
     break;
    }
   }
   $47 = HEAP32[$14>>2]|0;
   $$0 = $47;
  }
 } while(0);
 STACKTOP = sp;return ($$0|0);
}
function __ZN10__cxxabiv120__si_class_type_infoD0Ev($0) {
 $0 = $0|0;
 var label = 0, sp = 0;
 sp = STACKTOP;
 __ZN10__cxxabiv116__shim_type_infoD2Ev($0);
 __ZdlPv($0);
 return;
}
function __ZNK10__cxxabiv120__si_class_type_info16search_above_dstEPNS_19__dynamic_cast_infoEPKvS4_ib($0,$1,$2,$3,$4,$5) {
 $0 = $0|0;
 $1 = $1|0;
 $2 = $2|0;
 $3 = $3|0;
 $4 = $4|0;
 $5 = $5|0;
 var $10 = 0, $11 = 0, $12 = 0, $13 = 0, $6 = 0, $7 = 0, $8 = 0, $9 = 0, label = 0, sp = 0;
 sp = STACKTOP;
 $6 = ((($1)) + 8|0);
 $7 = HEAP32[$6>>2]|0;
 $8 = (__ZN10__cxxabiv18is_equalEPKSt9type_infoS2_b($0,$7,$5)|0);
 if ($8) {
  __ZNK10__cxxabiv117__class_type_info29process_static_type_above_dstEPNS_19__dynamic_cast_infoEPKvS4_i(0,$1,$2,$3,$4);
 } else {
  $9 = ((($0)) + 8|0);
  $10 = HEAP32[$9>>2]|0;
  $11 = HEAP32[$10>>2]|0;
  $12 = ((($11)) + 20|0);
  $13 = HEAP32[$12>>2]|0;
  FUNCTION_TABLE_viiiiii[$13 & 31]($10,$1,$2,$3,$4,$5);
 }
 return;
}
function __ZNK10__cxxabiv120__si_class_type_info16search_below_dstEPNS_19__dynamic_cast_infoEPKvib($0,$1,$2,$3,$4) {
 $0 = $0|0;
 $1 = $1|0;
 $2 = $2|0;
 $3 = $3|0;
 $4 = $4|0;
 var $$037$off038 = 0, $10 = 0, $11 = 0, $12 = 0, $13 = 0, $14 = 0, $15 = 0, $16 = 0, $17 = 0, $18 = 0, $19 = 0, $20 = 0, $21 = 0, $22 = 0, $23 = 0, $24 = 0, $25 = 0, $26 = 0, $27 = 0, $28 = 0;
 var $29 = 0, $30 = 0, $31 = 0, $32 = 0, $33 = 0, $34 = 0, $35 = 0, $36 = 0, $37 = 0, $38 = 0, $39 = 0, $40 = 0, $41 = 0, $42 = 0, $43 = 0, $44 = 0, $45 = 0, $46 = 0, $47 = 0, $48 = 0;
 var $5 = 0, $6 = 0, $7 = 0, $8 = 0, $9 = 0, label = 0, sp = 0;
 sp = STACKTOP;
 $5 = ((($1)) + 8|0);
 $6 = HEAP32[$5>>2]|0;
 $7 = (__ZN10__cxxabiv18is_equalEPKSt9type_infoS2_b($0,$6,$4)|0);
 do {
  if ($7) {
   __ZNK10__cxxabiv117__class_type_info29process_static_type_below_dstEPNS_19__dynamic_cast_infoEPKvi(0,$1,$2,$3);
  } else {
   $8 = HEAP32[$1>>2]|0;
   $9 = (__ZN10__cxxabiv18is_equalEPKSt9type_infoS2_b($0,$8,$4)|0);
   if (!($9)) {
    $44 = ((($0)) + 8|0);
    $45 = HEAP32[$44>>2]|0;
    $46 = HEAP32[$45>>2]|0;
    $47 = ((($46)) + 24|0);
    $48 = HEAP32[$47>>2]|0;
    FUNCTION_TABLE_viiiii[$48 & 31]($45,$1,$2,$3,$4);
    break;
   }
   $10 = ((($1)) + 16|0);
   $11 = HEAP32[$10>>2]|0;
   $12 = ($11|0)==($2|0);
   if (!($12)) {
    $13 = ((($1)) + 20|0);
    $14 = HEAP32[$13>>2]|0;
    $15 = ($14|0)==($2|0);
    if (!($15)) {
     $18 = ((($1)) + 32|0);
     HEAP32[$18>>2] = $3;
     $19 = ((($1)) + 44|0);
     $20 = HEAP32[$19>>2]|0;
     $21 = ($20|0)==(4);
     if ($21) {
      break;
     }
     $22 = ((($1)) + 52|0);
     HEAP8[$22>>0] = 0;
     $23 = ((($1)) + 53|0);
     HEAP8[$23>>0] = 0;
     $24 = ((($0)) + 8|0);
     $25 = HEAP32[$24>>2]|0;
     $26 = HEAP32[$25>>2]|0;
     $27 = ((($26)) + 20|0);
     $28 = HEAP32[$27>>2]|0;
     FUNCTION_TABLE_viiiiii[$28 & 31]($25,$1,$2,$2,1,$4);
     $29 = HEAP8[$23>>0]|0;
     $30 = ($29<<24>>24)==(0);
     if ($30) {
      $$037$off038 = 0;
      label = 11;
     } else {
      $31 = HEAP8[$22>>0]|0;
      $32 = ($31<<24>>24)==(0);
      if ($32) {
       $$037$off038 = 1;
       label = 11;
      } else {
       label = 15;
      }
     }
     do {
      if ((label|0) == 11) {
       HEAP32[$13>>2] = $2;
       $33 = ((($1)) + 40|0);
       $34 = HEAP32[$33>>2]|0;
       $35 = (($34) + 1)|0;
       HEAP32[$33>>2] = $35;
       $36 = ((($1)) + 36|0);
       $37 = HEAP32[$36>>2]|0;
       $38 = ($37|0)==(1);
       if ($38) {
        $39 = ((($1)) + 24|0);
        $40 = HEAP32[$39>>2]|0;
        $41 = ($40|0)==(2);
        if ($41) {
         $42 = ((($1)) + 54|0);
         HEAP8[$42>>0] = 1;
         if ($$037$off038) {
          label = 15;
          break;
         } else {
          $43 = 4;
          break;
         }
        }
       }
       if ($$037$off038) {
        label = 15;
       } else {
        $43 = 4;
       }
      }
     } while(0);
     if ((label|0) == 15) {
      $43 = 3;
     }
     HEAP32[$19>>2] = $43;
     break;
    }
   }
   $16 = ($3|0)==(1);
   if ($16) {
    $17 = ((($1)) + 32|0);
    HEAP32[$17>>2] = 1;
   }
  }
 } while(0);
 return;
}
function __ZNK10__cxxabiv120__si_class_type_info27has_unambiguous_public_baseEPNS_19__dynamic_cast_infoEPvi($0,$1,$2,$3) {
 $0 = $0|0;
 $1 = $1|0;
 $2 = $2|0;
 $3 = $3|0;
 var $10 = 0, $11 = 0, $4 = 0, $5 = 0, $6 = 0, $7 = 0, $8 = 0, $9 = 0, label = 0, sp = 0;
 sp = STACKTOP;
 $4 = ((($1)) + 8|0);
 $5 = HEAP32[$4>>2]|0;
 $6 = (__ZN10__cxxabiv18is_equalEPKSt9type_infoS2_b($0,$5,0)|0);
 if ($6) {
  __ZNK10__cxxabiv117__class_type_info24process_found_base_classEPNS_19__dynamic_cast_infoEPvi(0,$1,$2,$3);
 } else {
  $7 = ((($0)) + 8|0);
  $8 = HEAP32[$7>>2]|0;
  $9 = HEAP32[$8>>2]|0;
  $10 = ((($9)) + 28|0);
  $11 = HEAP32[$10>>2]|0;
  FUNCTION_TABLE_viiii[$11 & 31]($8,$1,$2,$3);
 }
 return;
}
function __ZNSt9type_infoD2Ev($0) {
 $0 = $0|0;
 var label = 0, sp = 0;
 sp = STACKTOP;
 return;
}
function __ZN10__cxxabiv123__fundamental_type_infoD0Ev($0) {
 $0 = $0|0;
 var label = 0, sp = 0;
 sp = STACKTOP;
 __ZN10__cxxabiv116__shim_type_infoD2Ev($0);
 __ZdlPv($0);
 return;
}
function __ZNK10__cxxabiv123__fundamental_type_info9can_catchEPKNS_16__shim_type_infoERPv($0,$1,$2) {
 $0 = $0|0;
 $1 = $1|0;
 $2 = $2|0;
 var $3 = 0, label = 0, sp = 0;
 sp = STACKTOP;
 $3 = (__ZN10__cxxabiv18is_equalEPKSt9type_infoS2_b($0,$1,0)|0);
 return ($3|0);
}
function __ZN10__cxxabiv119__pointer_type_infoD0Ev($0) {
 $0 = $0|0;
 var label = 0, sp = 0;
 sp = STACKTOP;
 __ZN10__cxxabiv116__shim_type_infoD2Ev($0);
 __ZdlPv($0);
 return;
}
function __ZNK10__cxxabiv119__pointer_type_info9can_catchEPKNS_16__shim_type_infoERPv($0,$1,$2) {
 $0 = $0|0;
 $1 = $1|0;
 $2 = $2|0;
 var $$0 = 0, $$4 = 0, $10 = 0, $11 = 0, $12 = 0, $13 = 0, $14 = 0, $15 = 0, $16 = 0, $17 = 0, $18 = 0, $19 = 0, $20 = 0, $21 = 0, $22 = 0, $23 = 0, $24 = 0, $25 = 0, $26 = 0, $27 = 0;
 var $28 = 0, $29 = 0, $3 = 0, $30 = 0, $31 = 0, $32 = 0, $33 = 0, $34 = 0, $35 = 0, $36 = 0, $37 = 0, $38 = 0, $39 = 0, $4 = 0, $40 = 0, $41 = 0, $42 = 0, $43 = 0, $44 = 0, $5 = 0;
 var $6 = 0, $7 = 0, $8 = 0, $9 = 0, dest = 0, label = 0, sp = 0, stop = 0;
 sp = STACKTOP;
 STACKTOP = STACKTOP + 64|0; if ((STACKTOP|0) >= (STACK_MAX|0)) abortStackOverflow(64|0);
 $3 = sp;
 $4 = HEAP32[$2>>2]|0;
 $5 = HEAP32[$4>>2]|0;
 HEAP32[$2>>2] = $5;
 $6 = (__ZNK10__cxxabiv117__pbase_type_info9can_catchEPKNS_16__shim_type_infoERPv($0,$1,0)|0);
 if ($6) {
  $$4 = 1;
 } else {
  $7 = ($1|0)==(0|0);
  if ($7) {
   $$4 = 0;
  } else {
   $8 = (___dynamic_cast($1,248,304,0)|0);
   $9 = ($8|0)==(0|0);
   if ($9) {
    $$4 = 0;
   } else {
    $10 = ((($8)) + 8|0);
    $11 = HEAP32[$10>>2]|0;
    $12 = ((($0)) + 8|0);
    $13 = HEAP32[$12>>2]|0;
    $14 = $13 ^ -1;
    $15 = $11 & $14;
    $16 = ($15|0)==(0);
    if ($16) {
     $17 = ((($0)) + 12|0);
     $18 = HEAP32[$17>>2]|0;
     $19 = ((($8)) + 12|0);
     $20 = HEAP32[$19>>2]|0;
     $21 = (__ZN10__cxxabiv18is_equalEPKSt9type_infoS2_b($18,$20,0)|0);
     if ($21) {
      $$4 = 1;
     } else {
      $22 = HEAP32[$17>>2]|0;
      $23 = (__ZN10__cxxabiv18is_equalEPKSt9type_infoS2_b($22,336,0)|0);
      if ($23) {
       $$4 = 1;
      } else {
       $24 = HEAP32[$17>>2]|0;
       $25 = ($24|0)==(0|0);
       if ($25) {
        $$4 = 0;
       } else {
        $26 = (___dynamic_cast($24,248,232,0)|0);
        $27 = ($26|0)==(0|0);
        if ($27) {
         $$4 = 0;
        } else {
         $28 = HEAP32[$19>>2]|0;
         $29 = ($28|0)==(0|0);
         if ($29) {
          $$4 = 0;
         } else {
          $30 = (___dynamic_cast($28,248,232,0)|0);
          $31 = ($30|0)==(0|0);
          if ($31) {
           $$4 = 0;
          } else {
           $32 = ((($3)) + 4|0);
           dest=$32; stop=dest+52|0; do { HEAP32[dest>>2]=0|0; dest=dest+4|0; } while ((dest|0) < (stop|0));
           HEAP32[$3>>2] = $30;
           $33 = ((($3)) + 8|0);
           HEAP32[$33>>2] = $26;
           $34 = ((($3)) + 12|0);
           HEAP32[$34>>2] = -1;
           $35 = ((($3)) + 48|0);
           HEAP32[$35>>2] = 1;
           $36 = HEAP32[$30>>2]|0;
           $37 = ((($36)) + 28|0);
           $38 = HEAP32[$37>>2]|0;
           $39 = HEAP32[$2>>2]|0;
           FUNCTION_TABLE_viiii[$38 & 31]($30,$3,$39,1);
           $40 = ((($3)) + 24|0);
           $41 = HEAP32[$40>>2]|0;
           $42 = ($41|0)==(1);
           if ($42) {
            $43 = ((($3)) + 16|0);
            $44 = HEAP32[$43>>2]|0;
            HEAP32[$2>>2] = $44;
            $$0 = 1;
           } else {
            $$0 = 0;
           }
           $$4 = $$0;
          }
         }
        }
       }
      }
     }
    } else {
     $$4 = 0;
    }
   }
  }
 }
 STACKTOP = sp;return ($$4|0);
}
function __ZNK10__cxxabiv117__pbase_type_info9can_catchEPKNS_16__shim_type_infoERPv($0,$1,$2) {
 $0 = $0|0;
 $1 = $1|0;
 $2 = $2|0;
 var $$0 = 0, $3 = 0, $4 = 0, label = 0, sp = 0;
 sp = STACKTOP;
 $3 = (__ZN10__cxxabiv18is_equalEPKSt9type_infoS2_b($0,$1,0)|0);
 if ($3) {
  $$0 = 1;
 } else {
  $4 = (__ZN10__cxxabiv18is_equalEPKSt9type_infoS2_b($1,344,0)|0);
  $$0 = $4;
 }
 return ($$0|0);
}
function __ZN10__cxxabiv121__vmi_class_type_infoD0Ev($0) {
 $0 = $0|0;
 var label = 0, sp = 0;
 sp = STACKTOP;
 __ZN10__cxxabiv116__shim_type_infoD2Ev($0);
 __ZdlPv($0);
 return;
}
function __ZNK10__cxxabiv121__vmi_class_type_info16search_above_dstEPNS_19__dynamic_cast_infoEPKvS4_ib($0,$1,$2,$3,$4,$5) {
 $0 = $0|0;
 $1 = $1|0;
 $2 = $2|0;
 $3 = $3|0;
 $4 = $4|0;
 $5 = $5|0;
 var $$0 = 0, $10 = 0, $11 = 0, $12 = 0, $13 = 0, $14 = 0, $15 = 0, $16 = 0, $17 = 0, $18 = 0, $19 = 0, $20 = 0, $21 = 0, $22 = 0, $23 = 0, $24 = 0, $25 = 0, $26 = 0, $27 = 0, $28 = 0;
 var $29 = 0, $30 = 0, $31 = 0, $32 = 0, $33 = 0, $34 = 0, $35 = 0, $36 = 0, $37 = 0, $6 = 0, $7 = 0, $8 = 0, $9 = 0, label = 0, sp = 0;
 sp = STACKTOP;
 $6 = ((($1)) + 8|0);
 $7 = HEAP32[$6>>2]|0;
 $8 = (__ZN10__cxxabiv18is_equalEPKSt9type_infoS2_b($0,$7,$5)|0);
 if ($8) {
  __ZNK10__cxxabiv117__class_type_info29process_static_type_above_dstEPNS_19__dynamic_cast_infoEPKvS4_i(0,$1,$2,$3,$4);
 } else {
  $9 = ((($1)) + 52|0);
  $10 = HEAP8[$9>>0]|0;
  $11 = ((($1)) + 53|0);
  $12 = HEAP8[$11>>0]|0;
  $13 = ((($0)) + 16|0);
  $14 = ((($0)) + 12|0);
  $15 = HEAP32[$14>>2]|0;
  $16 = (((($0)) + 16|0) + ($15<<3)|0);
  HEAP8[$9>>0] = 0;
  HEAP8[$11>>0] = 0;
  __ZNK10__cxxabiv122__base_class_type_info16search_above_dstEPNS_19__dynamic_cast_infoEPKvS4_ib($13,$1,$2,$3,$4,$5);
  $17 = ($15|0)>(1);
  L4: do {
   if ($17) {
    $18 = ((($0)) + 24|0);
    $19 = ((($1)) + 24|0);
    $20 = ((($0)) + 8|0);
    $21 = ((($1)) + 54|0);
    $$0 = $18;
    while(1) {
     $22 = HEAP8[$21>>0]|0;
     $23 = ($22<<24>>24)==(0);
     if (!($23)) {
      break L4;
     }
     $24 = HEAP8[$9>>0]|0;
     $25 = ($24<<24>>24)==(0);
     if ($25) {
      $31 = HEAP8[$11>>0]|0;
      $32 = ($31<<24>>24)==(0);
      if (!($32)) {
       $33 = HEAP32[$20>>2]|0;
       $34 = $33 & 1;
       $35 = ($34|0)==(0);
       if ($35) {
        break L4;
       }
      }
     } else {
      $26 = HEAP32[$19>>2]|0;
      $27 = ($26|0)==(1);
      if ($27) {
       break L4;
      }
      $28 = HEAP32[$20>>2]|0;
      $29 = $28 & 2;
      $30 = ($29|0)==(0);
      if ($30) {
       break L4;
      }
     }
     HEAP8[$9>>0] = 0;
     HEAP8[$11>>0] = 0;
     __ZNK10__cxxabiv122__base_class_type_info16search_above_dstEPNS_19__dynamic_cast_infoEPKvS4_ib($$0,$1,$2,$3,$4,$5);
     $36 = ((($$0)) + 8|0);
     $37 = ($36>>>0)<($16>>>0);
     if ($37) {
      $$0 = $36;
     } else {
      break;
     }
    }
   }
  } while(0);
  HEAP8[$9>>0] = $10;
  HEAP8[$11>>0] = $12;
 }
 return;
}
function __ZNK10__cxxabiv121__vmi_class_type_info16search_below_dstEPNS_19__dynamic_cast_infoEPKvib($0,$1,$2,$3,$4) {
 $0 = $0|0;
 $1 = $1|0;
 $2 = $2|0;
 $3 = $3|0;
 $4 = $4|0;
 var $$0 = 0, $$081$off0 = 0, $$084 = 0, $$085$off0 = 0, $$1 = 0, $$182$off0 = 0, $$186$off0 = 0, $$2 = 0, $$283$off0 = 0, $10 = 0, $11 = 0, $12 = 0, $13 = 0, $14 = 0, $15 = 0, $16 = 0, $17 = 0, $18 = 0, $19 = 0, $20 = 0;
 var $21 = 0, $22 = 0, $23 = 0, $24 = 0, $25 = 0, $26 = 0, $27 = 0, $28 = 0, $29 = 0, $30 = 0, $31 = 0, $32 = 0, $33 = 0, $34 = 0, $35 = 0, $36 = 0, $37 = 0, $38 = 0, $39 = 0, $40 = 0;
 var $41 = 0, $42 = 0, $43 = 0, $44 = 0, $45 = 0, $46 = 0, $47 = 0, $48 = 0, $49 = 0, $5 = 0, $50 = 0, $51 = 0, $52 = 0, $53 = 0, $54 = 0, $55 = 0, $56 = 0, $57 = 0, $58 = 0, $59 = 0;
 var $6 = 0, $60 = 0, $61 = 0, $62 = 0, $63 = 0, $64 = 0, $65 = 0, $66 = 0, $67 = 0, $68 = 0, $69 = 0, $7 = 0, $70 = 0, $71 = 0, $72 = 0, $73 = 0, $74 = 0, $75 = 0, $76 = 0, $77 = 0;
 var $78 = 0, $79 = 0, $8 = 0, $80 = 0, $81 = 0, $82 = 0, $83 = 0, $84 = 0, $85 = 0, $86 = 0, $87 = 0, $88 = 0, $89 = 0, $9 = 0, $90 = 0, $91 = 0, $92 = 0, label = 0, sp = 0;
 sp = STACKTOP;
 $5 = ((($1)) + 8|0);
 $6 = HEAP32[$5>>2]|0;
 $7 = (__ZN10__cxxabiv18is_equalEPKSt9type_infoS2_b($0,$6,$4)|0);
 L1: do {
  if ($7) {
   __ZNK10__cxxabiv117__class_type_info29process_static_type_below_dstEPNS_19__dynamic_cast_infoEPKvi(0,$1,$2,$3);
  } else {
   $8 = HEAP32[$1>>2]|0;
   $9 = (__ZN10__cxxabiv18is_equalEPKSt9type_infoS2_b($0,$8,$4)|0);
   if (!($9)) {
    $56 = ((($0)) + 16|0);
    $57 = ((($0)) + 12|0);
    $58 = HEAP32[$57>>2]|0;
    $59 = (((($0)) + 16|0) + ($58<<3)|0);
    __ZNK10__cxxabiv122__base_class_type_info16search_below_dstEPNS_19__dynamic_cast_infoEPKvib($56,$1,$2,$3,$4);
    $60 = ((($0)) + 24|0);
    $61 = ($58|0)>(1);
    if (!($61)) {
     break;
    }
    $62 = ((($0)) + 8|0);
    $63 = HEAP32[$62>>2]|0;
    $64 = $63 & 2;
    $65 = ($64|0)==(0);
    if ($65) {
     $66 = ((($1)) + 36|0);
     $67 = HEAP32[$66>>2]|0;
     $68 = ($67|0)==(1);
     if (!($68)) {
      $74 = $63 & 1;
      $75 = ($74|0)==(0);
      if ($75) {
       $86 = ((($1)) + 54|0);
       $$2 = $60;
       while(1) {
        $87 = HEAP8[$86>>0]|0;
        $88 = ($87<<24>>24)==(0);
        if (!($88)) {
         break L1;
        }
        $89 = HEAP32[$66>>2]|0;
        $90 = ($89|0)==(1);
        if ($90) {
         break L1;
        }
        __ZNK10__cxxabiv122__base_class_type_info16search_below_dstEPNS_19__dynamic_cast_infoEPKvib($$2,$1,$2,$3,$4);
        $91 = ((($$2)) + 8|0);
        $92 = ($91>>>0)<($59>>>0);
        if ($92) {
         $$2 = $91;
        } else {
         break L1;
        }
       }
      }
      $76 = ((($1)) + 24|0);
      $77 = ((($1)) + 54|0);
      $$1 = $60;
      while(1) {
       $78 = HEAP8[$77>>0]|0;
       $79 = ($78<<24>>24)==(0);
       if (!($79)) {
        break L1;
       }
       $80 = HEAP32[$66>>2]|0;
       $81 = ($80|0)==(1);
       if ($81) {
        $82 = HEAP32[$76>>2]|0;
        $83 = ($82|0)==(1);
        if ($83) {
         break L1;
        }
       }
       __ZNK10__cxxabiv122__base_class_type_info16search_below_dstEPNS_19__dynamic_cast_infoEPKvib($$1,$1,$2,$3,$4);
       $84 = ((($$1)) + 8|0);
       $85 = ($84>>>0)<($59>>>0);
       if ($85) {
        $$1 = $84;
       } else {
        break L1;
       }
      }
     }
    }
    $69 = ((($1)) + 54|0);
    $$0 = $60;
    while(1) {
     $70 = HEAP8[$69>>0]|0;
     $71 = ($70<<24>>24)==(0);
     if (!($71)) {
      break L1;
     }
     __ZNK10__cxxabiv122__base_class_type_info16search_below_dstEPNS_19__dynamic_cast_infoEPKvib($$0,$1,$2,$3,$4);
     $72 = ((($$0)) + 8|0);
     $73 = ($72>>>0)<($59>>>0);
     if ($73) {
      $$0 = $72;
     } else {
      break L1;
     }
    }
   }
   $10 = ((($1)) + 16|0);
   $11 = HEAP32[$10>>2]|0;
   $12 = ($11|0)==($2|0);
   if (!($12)) {
    $13 = ((($1)) + 20|0);
    $14 = HEAP32[$13>>2]|0;
    $15 = ($14|0)==($2|0);
    if (!($15)) {
     $18 = ((($1)) + 32|0);
     HEAP32[$18>>2] = $3;
     $19 = ((($1)) + 44|0);
     $20 = HEAP32[$19>>2]|0;
     $21 = ($20|0)==(4);
     if ($21) {
      break;
     }
     $22 = ((($0)) + 16|0);
     $23 = ((($0)) + 12|0);
     $24 = HEAP32[$23>>2]|0;
     $25 = (((($0)) + 16|0) + ($24<<3)|0);
     $26 = ((($1)) + 52|0);
     $27 = ((($1)) + 53|0);
     $28 = ((($1)) + 54|0);
     $29 = ((($0)) + 8|0);
     $30 = ((($1)) + 24|0);
     $$081$off0 = 0;$$084 = $22;$$085$off0 = 0;
     L32: while(1) {
      $31 = ($$084>>>0)<($25>>>0);
      if (!($31)) {
       $$283$off0 = $$081$off0;
       label = 18;
       break;
      }
      HEAP8[$26>>0] = 0;
      HEAP8[$27>>0] = 0;
      __ZNK10__cxxabiv122__base_class_type_info16search_above_dstEPNS_19__dynamic_cast_infoEPKvS4_ib($$084,$1,$2,$2,1,$4);
      $32 = HEAP8[$28>>0]|0;
      $33 = ($32<<24>>24)==(0);
      if (!($33)) {
       $$283$off0 = $$081$off0;
       label = 18;
       break;
      }
      $34 = HEAP8[$27>>0]|0;
      $35 = ($34<<24>>24)==(0);
      do {
       if ($35) {
        $$182$off0 = $$081$off0;$$186$off0 = $$085$off0;
       } else {
        $36 = HEAP8[$26>>0]|0;
        $37 = ($36<<24>>24)==(0);
        if ($37) {
         $43 = HEAP32[$29>>2]|0;
         $44 = $43 & 1;
         $45 = ($44|0)==(0);
         if ($45) {
          $$283$off0 = 1;
          label = 18;
          break L32;
         } else {
          $$182$off0 = 1;$$186$off0 = $$085$off0;
          break;
         }
        }
        $38 = HEAP32[$30>>2]|0;
        $39 = ($38|0)==(1);
        if ($39) {
         label = 23;
         break L32;
        }
        $40 = HEAP32[$29>>2]|0;
        $41 = $40 & 2;
        $42 = ($41|0)==(0);
        if ($42) {
         label = 23;
         break L32;
        } else {
         $$182$off0 = 1;$$186$off0 = 1;
        }
       }
      } while(0);
      $46 = ((($$084)) + 8|0);
      $$081$off0 = $$182$off0;$$084 = $46;$$085$off0 = $$186$off0;
     }
     do {
      if ((label|0) == 18) {
       if (!($$085$off0)) {
        HEAP32[$13>>2] = $2;
        $47 = ((($1)) + 40|0);
        $48 = HEAP32[$47>>2]|0;
        $49 = (($48) + 1)|0;
        HEAP32[$47>>2] = $49;
        $50 = ((($1)) + 36|0);
        $51 = HEAP32[$50>>2]|0;
        $52 = ($51|0)==(1);
        if ($52) {
         $53 = HEAP32[$30>>2]|0;
         $54 = ($53|0)==(2);
         if ($54) {
          HEAP8[$28>>0] = 1;
          if ($$283$off0) {
           label = 23;
           break;
          } else {
           $55 = 4;
           break;
          }
         }
        }
       }
       if ($$283$off0) {
        label = 23;
       } else {
        $55 = 4;
       }
      }
     } while(0);
     if ((label|0) == 23) {
      $55 = 3;
     }
     HEAP32[$19>>2] = $55;
     break;
    }
   }
   $16 = ($3|0)==(1);
   if ($16) {
    $17 = ((($1)) + 32|0);
    HEAP32[$17>>2] = 1;
   }
  }
 } while(0);
 return;
}
function __ZNK10__cxxabiv121__vmi_class_type_info27has_unambiguous_public_baseEPNS_19__dynamic_cast_infoEPvi($0,$1,$2,$3) {
 $0 = $0|0;
 $1 = $1|0;
 $2 = $2|0;
 $3 = $3|0;
 var $$0 = 0, $10 = 0, $11 = 0, $12 = 0, $13 = 0, $14 = 0, $15 = 0, $16 = 0, $17 = 0, $4 = 0, $5 = 0, $6 = 0, $7 = 0, $8 = 0, $9 = 0, label = 0, sp = 0;
 sp = STACKTOP;
 $4 = ((($1)) + 8|0);
 $5 = HEAP32[$4>>2]|0;
 $6 = (__ZN10__cxxabiv18is_equalEPKSt9type_infoS2_b($0,$5,0)|0);
 L1: do {
  if ($6) {
   __ZNK10__cxxabiv117__class_type_info24process_found_base_classEPNS_19__dynamic_cast_infoEPvi(0,$1,$2,$3);
  } else {
   $7 = ((($0)) + 16|0);
   $8 = ((($0)) + 12|0);
   $9 = HEAP32[$8>>2]|0;
   $10 = (((($0)) + 16|0) + ($9<<3)|0);
   __ZNK10__cxxabiv122__base_class_type_info27has_unambiguous_public_baseEPNS_19__dynamic_cast_infoEPvi($7,$1,$2,$3);
   $11 = ($9|0)>(1);
   if ($11) {
    $12 = ((($0)) + 24|0);
    $13 = ((($1)) + 54|0);
    $$0 = $12;
    while(1) {
     __ZNK10__cxxabiv122__base_class_type_info27has_unambiguous_public_baseEPNS_19__dynamic_cast_infoEPvi($$0,$1,$2,$3);
     $14 = HEAP8[$13>>0]|0;
     $15 = ($14<<24>>24)==(0);
     if (!($15)) {
      break L1;
     }
     $16 = ((($$0)) + 8|0);
     $17 = ($16>>>0)<($10>>>0);
     if ($17) {
      $$0 = $16;
     } else {
      break;
     }
    }
   }
  }
 } while(0);
 return;
}
function __ZNK10__cxxabiv122__base_class_type_info27has_unambiguous_public_baseEPNS_19__dynamic_cast_infoEPvi($0,$1,$2,$3) {
 $0 = $0|0;
 $1 = $1|0;
 $2 = $2|0;
 $3 = $3|0;
 var $$0 = 0, $10 = 0, $11 = 0, $12 = 0, $13 = 0, $14 = 0, $15 = 0, $16 = 0, $17 = 0, $18 = 0, $19 = 0, $4 = 0, $5 = 0, $6 = 0, $7 = 0, $8 = 0, $9 = 0, label = 0, sp = 0;
 sp = STACKTOP;
 $4 = ((($0)) + 4|0);
 $5 = HEAP32[$4>>2]|0;
 $6 = $5 >> 8;
 $7 = $5 & 1;
 $8 = ($7|0)==(0);
 if ($8) {
  $$0 = $6;
 } else {
  $9 = HEAP32[$2>>2]|0;
  $10 = (($9) + ($6)|0);
  $11 = HEAP32[$10>>2]|0;
  $$0 = $11;
 }
 $12 = HEAP32[$0>>2]|0;
 $13 = HEAP32[$12>>2]|0;
 $14 = ((($13)) + 28|0);
 $15 = HEAP32[$14>>2]|0;
 $16 = (($2) + ($$0)|0);
 $17 = $5 & 2;
 $18 = ($17|0)==(0);
 $19 = $18 ? 2 : $3;
 FUNCTION_TABLE_viiii[$15 & 31]($12,$1,$16,$19);
 return;
}
function __ZNK10__cxxabiv122__base_class_type_info16search_above_dstEPNS_19__dynamic_cast_infoEPKvS4_ib($0,$1,$2,$3,$4,$5) {
 $0 = $0|0;
 $1 = $1|0;
 $2 = $2|0;
 $3 = $3|0;
 $4 = $4|0;
 $5 = $5|0;
 var $$0 = 0, $10 = 0, $11 = 0, $12 = 0, $13 = 0, $14 = 0, $15 = 0, $16 = 0, $17 = 0, $18 = 0, $19 = 0, $20 = 0, $21 = 0, $6 = 0, $7 = 0, $8 = 0, $9 = 0, label = 0, sp = 0;
 sp = STACKTOP;
 $6 = ((($0)) + 4|0);
 $7 = HEAP32[$6>>2]|0;
 $8 = $7 >> 8;
 $9 = $7 & 1;
 $10 = ($9|0)==(0);
 if ($10) {
  $$0 = $8;
 } else {
  $11 = HEAP32[$3>>2]|0;
  $12 = (($11) + ($8)|0);
  $13 = HEAP32[$12>>2]|0;
  $$0 = $13;
 }
 $14 = HEAP32[$0>>2]|0;
 $15 = HEAP32[$14>>2]|0;
 $16 = ((($15)) + 20|0);
 $17 = HEAP32[$16>>2]|0;
 $18 = (($3) + ($$0)|0);
 $19 = $7 & 2;
 $20 = ($19|0)==(0);
 $21 = $20 ? 2 : $4;
 FUNCTION_TABLE_viiiiii[$17 & 31]($14,$1,$2,$18,$21,$5);
 return;
}
function __ZNK10__cxxabiv122__base_class_type_info16search_below_dstEPNS_19__dynamic_cast_infoEPKvib($0,$1,$2,$3,$4) {
 $0 = $0|0;
 $1 = $1|0;
 $2 = $2|0;
 $3 = $3|0;
 $4 = $4|0;
 var $$0 = 0, $10 = 0, $11 = 0, $12 = 0, $13 = 0, $14 = 0, $15 = 0, $16 = 0, $17 = 0, $18 = 0, $19 = 0, $20 = 0, $5 = 0, $6 = 0, $7 = 0, $8 = 0, $9 = 0, label = 0, sp = 0;
 sp = STACKTOP;
 $5 = ((($0)) + 4|0);
 $6 = HEAP32[$5>>2]|0;
 $7 = $6 >> 8;
 $8 = $6 & 1;
 $9 = ($8|0)==(0);
 if ($9) {
  $$0 = $7;
 } else {
  $10 = HEAP32[$2>>2]|0;
  $11 = (($10) + ($7)|0);
  $12 = HEAP32[$11>>2]|0;
  $$0 = $12;
 }
 $13 = HEAP32[$0>>2]|0;
 $14 = HEAP32[$13>>2]|0;
 $15 = ((($14)) + 24|0);
 $16 = HEAP32[$15>>2]|0;
 $17 = (($2) + ($$0)|0);
 $18 = $6 & 2;
 $19 = ($18|0)==(0);
 $20 = $19 ? 2 : $3;
 FUNCTION_TABLE_viiiii[$16 & 31]($13,$1,$17,$20,$4);
 return;
}
function __ZSt15get_new_handlerv() {
 var $0 = 0, $1 = 0, $2 = 0, label = 0, sp = 0;
 sp = STACKTOP;
 $0 = HEAP32[1206]|0;
 $1 = (($0) + 0)|0;
 HEAP32[1206] = $1;
 $2 = $0;
 return ($2|0);
}
function runPostSets() {
}
function _memcpy(dest, src, num) {
    dest = dest|0; src = src|0; num = num|0;
    var ret = 0;
    var aligned_dest_end = 0;
    var block_aligned_dest_end = 0;
    var dest_end = 0;
    // Test against a benchmarked cutoff limit for when HEAPU8.set() becomes faster to use.
    if ((num|0) >=
      8192
    ) {
      return _emscripten_memcpy_big(dest|0, src|0, num|0)|0;
    }

    ret = dest|0;
    dest_end = (dest + num)|0;
    if ((dest&3) == (src&3)) {
      // The initial unaligned < 4-byte front.
      while (dest & 3) {
        if ((num|0) == 0) return ret|0;
        HEAP8[((dest)>>0)]=((HEAP8[((src)>>0)])|0);
        dest = (dest+1)|0;
        src = (src+1)|0;
        num = (num-1)|0;
      }
      aligned_dest_end = (dest_end & -4)|0;
      block_aligned_dest_end = (aligned_dest_end - 64)|0;
      while ((dest|0) <= (block_aligned_dest_end|0) ) {
        HEAP32[((dest)>>2)]=((HEAP32[((src)>>2)])|0);
        HEAP32[(((dest)+(4))>>2)]=((HEAP32[(((src)+(4))>>2)])|0);
        HEAP32[(((dest)+(8))>>2)]=((HEAP32[(((src)+(8))>>2)])|0);
        HEAP32[(((dest)+(12))>>2)]=((HEAP32[(((src)+(12))>>2)])|0);
        HEAP32[(((dest)+(16))>>2)]=((HEAP32[(((src)+(16))>>2)])|0);
        HEAP32[(((dest)+(20))>>2)]=((HEAP32[(((src)+(20))>>2)])|0);
        HEAP32[(((dest)+(24))>>2)]=((HEAP32[(((src)+(24))>>2)])|0);
        HEAP32[(((dest)+(28))>>2)]=((HEAP32[(((src)+(28))>>2)])|0);
        HEAP32[(((dest)+(32))>>2)]=((HEAP32[(((src)+(32))>>2)])|0);
        HEAP32[(((dest)+(36))>>2)]=((HEAP32[(((src)+(36))>>2)])|0);
        HEAP32[(((dest)+(40))>>2)]=((HEAP32[(((src)+(40))>>2)])|0);
        HEAP32[(((dest)+(44))>>2)]=((HEAP32[(((src)+(44))>>2)])|0);
        HEAP32[(((dest)+(48))>>2)]=((HEAP32[(((src)+(48))>>2)])|0);
        HEAP32[(((dest)+(52))>>2)]=((HEAP32[(((src)+(52))>>2)])|0);
        HEAP32[(((dest)+(56))>>2)]=((HEAP32[(((src)+(56))>>2)])|0);
        HEAP32[(((dest)+(60))>>2)]=((HEAP32[(((src)+(60))>>2)])|0);
        dest = (dest+64)|0;
        src = (src+64)|0;
      }
      while ((dest|0) < (aligned_dest_end|0) ) {
        HEAP32[((dest)>>2)]=((HEAP32[((src)>>2)])|0);
        dest = (dest+4)|0;
        src = (src+4)|0;
      }
    } else {
      // In the unaligned copy case, unroll a bit as well.
      aligned_dest_end = (dest_end - 4)|0;
      while ((dest|0) < (aligned_dest_end|0) ) {
        HEAP8[((dest)>>0)]=((HEAP8[((src)>>0)])|0);
        HEAP8[(((dest)+(1))>>0)]=((HEAP8[(((src)+(1))>>0)])|0);
        HEAP8[(((dest)+(2))>>0)]=((HEAP8[(((src)+(2))>>0)])|0);
        HEAP8[(((dest)+(3))>>0)]=((HEAP8[(((src)+(3))>>0)])|0);
        dest = (dest+4)|0;
        src = (src+4)|0;
      }
    }
    // The remaining unaligned < 4 byte tail.
    while ((dest|0) < (dest_end|0)) {
      HEAP8[((dest)>>0)]=((HEAP8[((src)>>0)])|0);
      dest = (dest+1)|0;
      src = (src+1)|0;
    }
    return ret|0;
}
function _memset(ptr, value, num) {
    ptr = ptr|0; value = value|0; num = num|0;
    var end = 0, aligned_end = 0, block_aligned_end = 0, value4 = 0;
    end = (ptr + num)|0;

    value = value & 0xff;
    if ((num|0) >= 67 /* 64 bytes for an unrolled loop + 3 bytes for unaligned head*/) {
      while ((ptr&3) != 0) {
        HEAP8[((ptr)>>0)]=value;
        ptr = (ptr+1)|0;
      }

      aligned_end = (end & -4)|0;
      block_aligned_end = (aligned_end - 64)|0;
      value4 = value | (value << 8) | (value << 16) | (value << 24);

      while((ptr|0) <= (block_aligned_end|0)) {
        HEAP32[((ptr)>>2)]=value4;
        HEAP32[(((ptr)+(4))>>2)]=value4;
        HEAP32[(((ptr)+(8))>>2)]=value4;
        HEAP32[(((ptr)+(12))>>2)]=value4;
        HEAP32[(((ptr)+(16))>>2)]=value4;
        HEAP32[(((ptr)+(20))>>2)]=value4;
        HEAP32[(((ptr)+(24))>>2)]=value4;
        HEAP32[(((ptr)+(28))>>2)]=value4;
        HEAP32[(((ptr)+(32))>>2)]=value4;
        HEAP32[(((ptr)+(36))>>2)]=value4;
        HEAP32[(((ptr)+(40))>>2)]=value4;
        HEAP32[(((ptr)+(44))>>2)]=value4;
        HEAP32[(((ptr)+(48))>>2)]=value4;
        HEAP32[(((ptr)+(52))>>2)]=value4;
        HEAP32[(((ptr)+(56))>>2)]=value4;
        HEAP32[(((ptr)+(60))>>2)]=value4;
        ptr = (ptr + 64)|0;
      }

      while ((ptr|0) < (aligned_end|0) ) {
        HEAP32[((ptr)>>2)]=value4;
        ptr = (ptr+4)|0;
      }
    }
    // The remaining bytes.
    while ((ptr|0) < (end|0)) {
      HEAP8[((ptr)>>0)]=value;
      ptr = (ptr+1)|0;
    }
    return (end-num)|0;
}
function _sbrk(increment) {
    increment = increment|0;
    var oldDynamicTop = 0;
    var oldDynamicTopOnChange = 0;
    var newDynamicTop = 0;
    var totalMemory = 0;
    oldDynamicTop = HEAP32[DYNAMICTOP_PTR>>2]|0;
    newDynamicTop = oldDynamicTop + increment | 0;

    if (((increment|0) > 0 & (newDynamicTop|0) < (oldDynamicTop|0)) // Detect and fail if we would wrap around signed 32-bit int.
      | (newDynamicTop|0) < 0) { // Also underflow, sbrk() should be able to be used to subtract.
      abortOnCannotGrowMemory()|0;
      ___setErrNo(12);
      return -1;
    }

    HEAP32[DYNAMICTOP_PTR>>2] = newDynamicTop;
    totalMemory = getTotalMemory()|0;
    if ((newDynamicTop|0) > (totalMemory|0)) {
      if ((enlargeMemory()|0) == 0) {
        HEAP32[DYNAMICTOP_PTR>>2] = oldDynamicTop;
        ___setErrNo(12);
        return -1;
      }
    }
    return oldDynamicTop|0;
}

  
function dynCall_i(index) {
  index = index|0;
  
  return FUNCTION_TABLE_i[index&31]()|0;
}


function dynCall_ii(index,a1) {
  index = index|0;
  a1=a1|0;
  return FUNCTION_TABLE_ii[index&31](a1|0)|0;
}


function dynCall_iidiidddddddd(index,a1,a2,a3,a4,a5,a6,a7,a8,a9,a10,a11,a12) {
  index = index|0;
  a1=a1|0; a2=+a2; a3=a3|0; a4=a4|0; a5=+a5; a6=+a6; a7=+a7; a8=+a8; a9=+a9; a10=+a10; a11=+a11; a12=+a12;
  return FUNCTION_TABLE_iidiidddddddd[index&63](a1|0,+a2,a3|0,a4|0,+a5,+a6,+a7,+a8,+a9,+a10,+a11,+a12)|0;
}


function dynCall_iiidiidddddddd(index,a1,a2,a3,a4,a5,a6,a7,a8,a9,a10,a11,a12,a13) {
  index = index|0;
  a1=a1|0; a2=a2|0; a3=+a3; a4=a4|0; a5=a5|0; a6=+a6; a7=+a7; a8=+a8; a9=+a9; a10=+a10; a11=+a11; a12=+a12; a13=+a13;
  return FUNCTION_TABLE_iiidiidddddddd[index&63](a1|0,a2|0,+a3,a4|0,a5|0,+a6,+a7,+a8,+a9,+a10,+a11,+a12,+a13)|0;
}


function dynCall_iiii(index,a1,a2,a3) {
  index = index|0;
  a1=a1|0; a2=a2|0; a3=a3|0;
  return FUNCTION_TABLE_iiii[index&63](a1|0,a2|0,a3|0)|0;
}


function dynCall_v(index) {
  index = index|0;
  
  FUNCTION_TABLE_v[index&0]();
}


function dynCall_vi(index,a1) {
  index = index|0;
  a1=a1|0;
  FUNCTION_TABLE_vi[index&31](a1|0);
}


function dynCall_vii(index,a1,a2) {
  index = index|0;
  a1=a1|0; a2=a2|0;
  FUNCTION_TABLE_vii[index&31](a1|0,a2|0);
}


function dynCall_viid(index,a1,a2,a3) {
  index = index|0;
  a1=a1|0; a2=a2|0; a3=+a3;
  FUNCTION_TABLE_viid[index&31](a1|0,a2|0,+a3);
}


function dynCall_viiid(index,a1,a2,a3,a4) {
  index = index|0;
  a1=a1|0; a2=a2|0; a3=a3|0; a4=+a4;
  FUNCTION_TABLE_viiid[index&31](a1|0,a2|0,a3|0,+a4);
}


function dynCall_viiii(index,a1,a2,a3,a4) {
  index = index|0;
  a1=a1|0; a2=a2|0; a3=a3|0; a4=a4|0;
  FUNCTION_TABLE_viiii[index&31](a1|0,a2|0,a3|0,a4|0);
}


function dynCall_viiiii(index,a1,a2,a3,a4,a5) {
  index = index|0;
  a1=a1|0; a2=a2|0; a3=a3|0; a4=a4|0; a5=a5|0;
  FUNCTION_TABLE_viiiii[index&31](a1|0,a2|0,a3|0,a4|0,a5|0);
}


function dynCall_viiiiii(index,a1,a2,a3,a4,a5,a6) {
  index = index|0;
  a1=a1|0; a2=a2|0; a3=a3|0; a4=a4|0; a5=a5|0; a6=a6|0;
  FUNCTION_TABLE_viiiiii[index&31](a1|0,a2|0,a3|0,a4|0,a5|0,a6|0);
}

function b0() {
 ; nullFunc_i(0);return 0;
}
function b1(p0) {
 p0 = p0|0; nullFunc_ii(1);return 0;
}
function b2(p0,p1,p2,p3,p4,p5,p6,p7,p8,p9,p10,p11) {
 p0 = p0|0;p1 = +p1;p2 = p2|0;p3 = p3|0;p4 = +p4;p5 = +p5;p6 = +p6;p7 = +p7;p8 = +p8;p9 = +p9;p10 = +p10;p11 = +p11; nullFunc_iidiidddddddd(2);return 0;
}
function b3(p0,p1,p2,p3,p4,p5,p6,p7,p8,p9,p10,p11,p12) {
 p0 = p0|0;p1 = p1|0;p2 = +p2;p3 = p3|0;p4 = p4|0;p5 = +p5;p6 = +p6;p7 = +p7;p8 = +p8;p9 = +p9;p10 = +p10;p11 = +p11;p12 = +p12; nullFunc_iiidiidddddddd(3);return 0;
}
function b4(p0,p1,p2) {
 p0 = p0|0;p1 = p1|0;p2 = p2|0; nullFunc_iiii(4);return 0;
}
function b5() {
 ; nullFunc_v(5);
}
function b6(p0) {
 p0 = p0|0; nullFunc_vi(6);
}
function b7(p0,p1) {
 p0 = p0|0;p1 = p1|0; nullFunc_vii(7);
}
function b8(p0,p1,p2) {
 p0 = p0|0;p1 = p1|0;p2 = +p2; nullFunc_viid(8);
}
function b9(p0,p1,p2,p3) {
 p0 = p0|0;p1 = p1|0;p2 = p2|0;p3 = +p3; nullFunc_viiid(9);
}
function b10(p0,p1,p2,p3) {
 p0 = p0|0;p1 = p1|0;p2 = p2|0;p3 = p3|0; nullFunc_viiii(10);
}
function b11(p0,p1,p2,p3,p4) {
 p0 = p0|0;p1 = p1|0;p2 = p2|0;p3 = p3|0;p4 = p4|0; nullFunc_viiiii(11);
}
function b12(p0,p1,p2,p3,p4,p5) {
 p0 = p0|0;p1 = p1|0;p2 = p2|0;p3 = p3|0;p4 = p4|0;p5 = p5|0; nullFunc_viiiiii(12);
}

// EMSCRIPTEN_END_FUNCS
var FUNCTION_TABLE_i = [b0,b0,b0,b0,b0,b0,b0,b0,b0,b0,b0,b0,b0,b0,b0,b0,b0,b0,b0,b0,b0,b0,b0,b0,b0,b0,__ZN10emscripten8internal12operator_newI10NstrumentaJEEEPT_DpOT0_,b0,b0
,b0,b0,b0];
var FUNCTION_TABLE_ii = [b1,___stdio_close,b1,b1,b1,b1,b1,b1,b1,b1,b1,b1,b1,b1,b1,b1,b1,b1,b1,b1,b1,b1,b1,b1,__ZN10emscripten8internal13getActualTypeI10NstrumentaEEPKvPT_,b1,b1,__ZN10emscripten8internal7InvokerIP10NstrumentaJEE6invokeEPFS3_vE,b1
,b1,b1,b1];
var FUNCTION_TABLE_iidiidddddddd = [b2,b2,b2,b2,b2,b2,b2,b2,b2,b2,b2,b2,b2,b2,b2,b2,b2,b2,b2,b2,b2,b2,b2,b2,b2,b2,b2,b2,b2
,b2,b2,b2,__ZN10Nstrumenta11ReportEventEdjidddddddd,b2,b2,b2,b2,b2,b2,b2,b2,b2,b2,b2,b2,b2,b2,b2,b2,b2,b2,b2,b2,b2,b2,b2,b2,b2,b2
,b2,b2,b2,b2,b2];
var FUNCTION_TABLE_iiidiidddddddd = [b3,b3,b3,b3,b3,b3,b3,b3,b3,b3,b3,b3,b3,b3,b3,b3,b3,b3,b3,b3,b3,b3,b3,b3,b3,b3,b3,b3,b3
,b3,b3,b3,b3,__ZN10emscripten8internal13MethodInvokerIM10NstrumentaFidjiddddddddEiPS2_JdjiddddddddEE6invokeERKS4_S5_djidddddddd,b3,b3,b3,b3,b3,b3,b3,b3,b3,b3,b3,b3,b3,b3,b3,b3,b3,b3,b3,b3,b3,b3,b3,b3,b3
,b3,b3,b3,b3,b3];
var FUNCTION_TABLE_iiii = [b4,b4,___stdout_write,___stdio_seek,b4,b4,b4,b4,__ZNK10__cxxabiv117__class_type_info9can_catchEPKNS_16__shim_type_infoERPv,b4,b4,b4,b4,b4,b4,b4,b4,__ZNK10__cxxabiv123__fundamental_type_info9can_catchEPKNS_16__shim_type_infoERPv,b4,__ZNK10__cxxabiv119__pointer_type_info9can_catchEPKNS_16__shim_type_infoERPv,b4,b4,b4,b4,b4,b4,b4,b4,b4
,b4,b4,b4,b4,b4,___stdio_write,b4,b4,b4,b4,b4,b4,b4,b4,b4,b4,b4,b4,b4,b4,b4,b4,b4,b4,b4,b4,b4,b4,b4,b4
,b4,b4,b4,b4,b4];
var FUNCTION_TABLE_v = [b5];
var FUNCTION_TABLE_vi = [b6,b6,b6,b6,__ZN10__cxxabiv116__shim_type_infoD2Ev,__ZN10__cxxabiv117__class_type_infoD0Ev,__ZNK10__cxxabiv116__shim_type_info5noop1Ev,__ZNK10__cxxabiv116__shim_type_info5noop2Ev,b6,b6,b6,b6,__ZN10__cxxabiv120__si_class_type_infoD0Ev,b6,b6,b6,__ZN10__cxxabiv123__fundamental_type_infoD0Ev,b6,__ZN10__cxxabiv119__pointer_type_infoD0Ev,b6,__ZN10__cxxabiv121__vmi_class_type_infoD0Ev,b6,b6,b6,b6,__ZN10emscripten8internal14raw_destructorI10NstrumentaEEvPT_,b6,b6,__ZN10Nstrumenta4initEv
,b6,b6,b6];
var FUNCTION_TABLE_vii = [b7,b7,b7,b7,b7,b7,b7,b7,b7,b7,b7,b7,b7,b7,b7,b7,b7,b7,b7,b7,b7,b7,b7,b7,b7,b7,b7,b7,b7
,__ZN10emscripten8internal13MethodInvokerIM10NstrumentaFvvEvPS2_JEE6invokeERKS4_S5_,b7,b7];
var FUNCTION_TABLE_viid = [b8,b8,b8,b8,b8,b8,b8,b8,b8,b8,b8,b8,b8,b8,b8,b8,b8,b8,b8,b8,b8,b8,b8,b8,b8,b8,b8,b8,b8
,b8,__ZN10Nstrumenta12setParameterEid,b8];
var FUNCTION_TABLE_viiid = [b9,b9,b9,b9,b9,b9,b9,b9,b9,b9,b9,b9,b9,b9,b9,b9,b9,b9,b9,b9,b9,b9,b9,b9,b9,b9,b9,b9,b9
,b9,b9,__ZN10emscripten8internal13MethodInvokerIM10NstrumentaFvidEvPS2_JidEE6invokeERKS4_S5_id];
var FUNCTION_TABLE_viiii = [b10,b10,b10,b10,b10,b10,b10,b10,b10,b10,b10,__ZNK10__cxxabiv117__class_type_info27has_unambiguous_public_baseEPNS_19__dynamic_cast_infoEPvi,b10,b10,b10,__ZNK10__cxxabiv120__si_class_type_info27has_unambiguous_public_baseEPNS_19__dynamic_cast_infoEPvi,b10,b10,b10,b10,b10,b10,b10,__ZNK10__cxxabiv121__vmi_class_type_info27has_unambiguous_public_baseEPNS_19__dynamic_cast_infoEPvi,b10,b10,b10,b10,b10
,b10,b10,b10];
var FUNCTION_TABLE_viiiii = [b11,b11,b11,b11,b11,b11,b11,b11,b11,b11,__ZNK10__cxxabiv117__class_type_info16search_below_dstEPNS_19__dynamic_cast_infoEPKvib,b11,b11,b11,__ZNK10__cxxabiv120__si_class_type_info16search_below_dstEPNS_19__dynamic_cast_infoEPKvib,b11,b11,b11,b11,b11,b11,b11,__ZNK10__cxxabiv121__vmi_class_type_info16search_below_dstEPNS_19__dynamic_cast_infoEPKvib,b11,b11,b11,b11,b11,b11
,b11,b11,b11];
var FUNCTION_TABLE_viiiiii = [b12,b12,b12,b12,b12,b12,b12,b12,b12,__ZNK10__cxxabiv117__class_type_info16search_above_dstEPNS_19__dynamic_cast_infoEPKvS4_ib,b12,b12,b12,__ZNK10__cxxabiv120__si_class_type_info16search_above_dstEPNS_19__dynamic_cast_infoEPKvS4_ib,b12,b12,b12,b12,b12,b12,b12,__ZNK10__cxxabiv121__vmi_class_type_info16search_above_dstEPNS_19__dynamic_cast_infoEPKvS4_ib,b12,b12,b12,b12,b12,b12,b12
,b12,b12,b12];

  return { __GLOBAL__sub_I_bind_cpp: __GLOBAL__sub_I_bind_cpp, __GLOBAL__sub_I_nstrumenta_cpp: __GLOBAL__sub_I_nstrumenta_cpp, ___errno_location: ___errno_location, ___getTypeName: ___getTypeName, _fflush: _fflush, _free: _free, _malloc: _malloc, _memcpy: _memcpy, _memset: _memset, _sbrk: _sbrk, dynCall_i: dynCall_i, dynCall_ii: dynCall_ii, dynCall_iidiidddddddd: dynCall_iidiidddddddd, dynCall_iiidiidddddddd: dynCall_iiidiidddddddd, dynCall_iiii: dynCall_iiii, dynCall_v: dynCall_v, dynCall_vi: dynCall_vi, dynCall_vii: dynCall_vii, dynCall_viid: dynCall_viid, dynCall_viiid: dynCall_viiid, dynCall_viiii: dynCall_viiii, dynCall_viiiii: dynCall_viiiii, dynCall_viiiiii: dynCall_viiiiii, establishStackSpace: establishStackSpace, getTempRet0: getTempRet0, runPostSets: runPostSets, setTempRet0: setTempRet0, setThrew: setThrew, stackAlloc: stackAlloc, stackRestore: stackRestore, stackSave: stackSave };
})
// EMSCRIPTEN_END_ASM
(Module.asmGlobalArg, Module.asmLibraryArg, buffer);

var real___GLOBAL__sub_I_bind_cpp = asm["__GLOBAL__sub_I_bind_cpp"]; asm["__GLOBAL__sub_I_bind_cpp"] = function() {
  assert(runtimeInitialized, 'you need to wait for the runtime to be ready (e.g. wait for main() to be called)');
  assert(!runtimeExited, 'the runtime was exited (use NO_EXIT_RUNTIME to keep it alive after main() exits)');
  return real___GLOBAL__sub_I_bind_cpp.apply(null, arguments);
};

var real___GLOBAL__sub_I_nstrumenta_cpp = asm["__GLOBAL__sub_I_nstrumenta_cpp"]; asm["__GLOBAL__sub_I_nstrumenta_cpp"] = function() {
  assert(runtimeInitialized, 'you need to wait for the runtime to be ready (e.g. wait for main() to be called)');
  assert(!runtimeExited, 'the runtime was exited (use NO_EXIT_RUNTIME to keep it alive after main() exits)');
  return real___GLOBAL__sub_I_nstrumenta_cpp.apply(null, arguments);
};

var real____errno_location = asm["___errno_location"]; asm["___errno_location"] = function() {
  assert(runtimeInitialized, 'you need to wait for the runtime to be ready (e.g. wait for main() to be called)');
  assert(!runtimeExited, 'the runtime was exited (use NO_EXIT_RUNTIME to keep it alive after main() exits)');
  return real____errno_location.apply(null, arguments);
};

var real____getTypeName = asm["___getTypeName"]; asm["___getTypeName"] = function() {
  assert(runtimeInitialized, 'you need to wait for the runtime to be ready (e.g. wait for main() to be called)');
  assert(!runtimeExited, 'the runtime was exited (use NO_EXIT_RUNTIME to keep it alive after main() exits)');
  return real____getTypeName.apply(null, arguments);
};

var real__fflush = asm["_fflush"]; asm["_fflush"] = function() {
  assert(runtimeInitialized, 'you need to wait for the runtime to be ready (e.g. wait for main() to be called)');
  assert(!runtimeExited, 'the runtime was exited (use NO_EXIT_RUNTIME to keep it alive after main() exits)');
  return real__fflush.apply(null, arguments);
};

var real__free = asm["_free"]; asm["_free"] = function() {
  assert(runtimeInitialized, 'you need to wait for the runtime to be ready (e.g. wait for main() to be called)');
  assert(!runtimeExited, 'the runtime was exited (use NO_EXIT_RUNTIME to keep it alive after main() exits)');
  return real__free.apply(null, arguments);
};

var real__malloc = asm["_malloc"]; asm["_malloc"] = function() {
  assert(runtimeInitialized, 'you need to wait for the runtime to be ready (e.g. wait for main() to be called)');
  assert(!runtimeExited, 'the runtime was exited (use NO_EXIT_RUNTIME to keep it alive after main() exits)');
  return real__malloc.apply(null, arguments);
};

var real__sbrk = asm["_sbrk"]; asm["_sbrk"] = function() {
  assert(runtimeInitialized, 'you need to wait for the runtime to be ready (e.g. wait for main() to be called)');
  assert(!runtimeExited, 'the runtime was exited (use NO_EXIT_RUNTIME to keep it alive after main() exits)');
  return real__sbrk.apply(null, arguments);
};

var real_establishStackSpace = asm["establishStackSpace"]; asm["establishStackSpace"] = function() {
  assert(runtimeInitialized, 'you need to wait for the runtime to be ready (e.g. wait for main() to be called)');
  assert(!runtimeExited, 'the runtime was exited (use NO_EXIT_RUNTIME to keep it alive after main() exits)');
  return real_establishStackSpace.apply(null, arguments);
};

var real_getTempRet0 = asm["getTempRet0"]; asm["getTempRet0"] = function() {
  assert(runtimeInitialized, 'you need to wait for the runtime to be ready (e.g. wait for main() to be called)');
  assert(!runtimeExited, 'the runtime was exited (use NO_EXIT_RUNTIME to keep it alive after main() exits)');
  return real_getTempRet0.apply(null, arguments);
};

var real_setTempRet0 = asm["setTempRet0"]; asm["setTempRet0"] = function() {
  assert(runtimeInitialized, 'you need to wait for the runtime to be ready (e.g. wait for main() to be called)');
  assert(!runtimeExited, 'the runtime was exited (use NO_EXIT_RUNTIME to keep it alive after main() exits)');
  return real_setTempRet0.apply(null, arguments);
};

var real_setThrew = asm["setThrew"]; asm["setThrew"] = function() {
  assert(runtimeInitialized, 'you need to wait for the runtime to be ready (e.g. wait for main() to be called)');
  assert(!runtimeExited, 'the runtime was exited (use NO_EXIT_RUNTIME to keep it alive after main() exits)');
  return real_setThrew.apply(null, arguments);
};

var real_stackAlloc = asm["stackAlloc"]; asm["stackAlloc"] = function() {
  assert(runtimeInitialized, 'you need to wait for the runtime to be ready (e.g. wait for main() to be called)');
  assert(!runtimeExited, 'the runtime was exited (use NO_EXIT_RUNTIME to keep it alive after main() exits)');
  return real_stackAlloc.apply(null, arguments);
};

var real_stackRestore = asm["stackRestore"]; asm["stackRestore"] = function() {
  assert(runtimeInitialized, 'you need to wait for the runtime to be ready (e.g. wait for main() to be called)');
  assert(!runtimeExited, 'the runtime was exited (use NO_EXIT_RUNTIME to keep it alive after main() exits)');
  return real_stackRestore.apply(null, arguments);
};

var real_stackSave = asm["stackSave"]; asm["stackSave"] = function() {
  assert(runtimeInitialized, 'you need to wait for the runtime to be ready (e.g. wait for main() to be called)');
  assert(!runtimeExited, 'the runtime was exited (use NO_EXIT_RUNTIME to keep it alive after main() exits)');
  return real_stackSave.apply(null, arguments);
};
var __GLOBAL__sub_I_bind_cpp = Module["__GLOBAL__sub_I_bind_cpp"] = asm["__GLOBAL__sub_I_bind_cpp"];
var __GLOBAL__sub_I_nstrumenta_cpp = Module["__GLOBAL__sub_I_nstrumenta_cpp"] = asm["__GLOBAL__sub_I_nstrumenta_cpp"];
var ___errno_location = Module["___errno_location"] = asm["___errno_location"];
var ___getTypeName = Module["___getTypeName"] = asm["___getTypeName"];
var _fflush = Module["_fflush"] = asm["_fflush"];
var _free = Module["_free"] = asm["_free"];
var _malloc = Module["_malloc"] = asm["_malloc"];
var _memcpy = Module["_memcpy"] = asm["_memcpy"];
var _memset = Module["_memset"] = asm["_memset"];
var _sbrk = Module["_sbrk"] = asm["_sbrk"];
var establishStackSpace = Module["establishStackSpace"] = asm["establishStackSpace"];
var getTempRet0 = Module["getTempRet0"] = asm["getTempRet0"];
var runPostSets = Module["runPostSets"] = asm["runPostSets"];
var setTempRet0 = Module["setTempRet0"] = asm["setTempRet0"];
var setThrew = Module["setThrew"] = asm["setThrew"];
var stackAlloc = Module["stackAlloc"] = asm["stackAlloc"];
var stackRestore = Module["stackRestore"] = asm["stackRestore"];
var stackSave = Module["stackSave"] = asm["stackSave"];
var dynCall_i = Module["dynCall_i"] = asm["dynCall_i"];
var dynCall_ii = Module["dynCall_ii"] = asm["dynCall_ii"];
var dynCall_iidiidddddddd = Module["dynCall_iidiidddddddd"] = asm["dynCall_iidiidddddddd"];
var dynCall_iiidiidddddddd = Module["dynCall_iiidiidddddddd"] = asm["dynCall_iiidiidddddddd"];
var dynCall_iiii = Module["dynCall_iiii"] = asm["dynCall_iiii"];
var dynCall_v = Module["dynCall_v"] = asm["dynCall_v"];
var dynCall_vi = Module["dynCall_vi"] = asm["dynCall_vi"];
var dynCall_vii = Module["dynCall_vii"] = asm["dynCall_vii"];
var dynCall_viid = Module["dynCall_viid"] = asm["dynCall_viid"];
var dynCall_viiid = Module["dynCall_viiid"] = asm["dynCall_viiid"];
var dynCall_viiii = Module["dynCall_viiii"] = asm["dynCall_viiii"];
var dynCall_viiiii = Module["dynCall_viiiii"] = asm["dynCall_viiiii"];
var dynCall_viiiiii = Module["dynCall_viiiiii"] = asm["dynCall_viiiiii"];
;



// === Auto-generated postamble setup entry stuff ===

Module['asm'] = asm;

if (!Module["intArrayFromString"]) Module["intArrayFromString"] = function() { abort("'intArrayFromString' was not exported. add it to EXTRA_EXPORTED_RUNTIME_METHODS (see the FAQ)") };
if (!Module["intArrayToString"]) Module["intArrayToString"] = function() { abort("'intArrayToString' was not exported. add it to EXTRA_EXPORTED_RUNTIME_METHODS (see the FAQ)") };
if (!Module["ccall"]) Module["ccall"] = function() { abort("'ccall' was not exported. add it to EXTRA_EXPORTED_RUNTIME_METHODS (see the FAQ)") };
if (!Module["cwrap"]) Module["cwrap"] = function() { abort("'cwrap' was not exported. add it to EXTRA_EXPORTED_RUNTIME_METHODS (see the FAQ)") };
if (!Module["setValue"]) Module["setValue"] = function() { abort("'setValue' was not exported. add it to EXTRA_EXPORTED_RUNTIME_METHODS (see the FAQ)") };
if (!Module["getValue"]) Module["getValue"] = function() { abort("'getValue' was not exported. add it to EXTRA_EXPORTED_RUNTIME_METHODS (see the FAQ)") };
if (!Module["allocate"]) Module["allocate"] = function() { abort("'allocate' was not exported. add it to EXTRA_EXPORTED_RUNTIME_METHODS (see the FAQ)") };
if (!Module["getMemory"]) Module["getMemory"] = function() { abort("'getMemory' was not exported. add it to EXTRA_EXPORTED_RUNTIME_METHODS (see the FAQ). Alternatively, forcing filesystem support (-s FORCE_FILESYSTEM=1) can export this for you") };
if (!Module["Pointer_stringify"]) Module["Pointer_stringify"] = function() { abort("'Pointer_stringify' was not exported. add it to EXTRA_EXPORTED_RUNTIME_METHODS (see the FAQ)") };
if (!Module["AsciiToString"]) Module["AsciiToString"] = function() { abort("'AsciiToString' was not exported. add it to EXTRA_EXPORTED_RUNTIME_METHODS (see the FAQ)") };
if (!Module["stringToAscii"]) Module["stringToAscii"] = function() { abort("'stringToAscii' was not exported. add it to EXTRA_EXPORTED_RUNTIME_METHODS (see the FAQ)") };
if (!Module["UTF8ArrayToString"]) Module["UTF8ArrayToString"] = function() { abort("'UTF8ArrayToString' was not exported. add it to EXTRA_EXPORTED_RUNTIME_METHODS (see the FAQ)") };
if (!Module["UTF8ToString"]) Module["UTF8ToString"] = function() { abort("'UTF8ToString' was not exported. add it to EXTRA_EXPORTED_RUNTIME_METHODS (see the FAQ)") };
if (!Module["stringToUTF8Array"]) Module["stringToUTF8Array"] = function() { abort("'stringToUTF8Array' was not exported. add it to EXTRA_EXPORTED_RUNTIME_METHODS (see the FAQ)") };
if (!Module["stringToUTF8"]) Module["stringToUTF8"] = function() { abort("'stringToUTF8' was not exported. add it to EXTRA_EXPORTED_RUNTIME_METHODS (see the FAQ)") };
if (!Module["lengthBytesUTF8"]) Module["lengthBytesUTF8"] = function() { abort("'lengthBytesUTF8' was not exported. add it to EXTRA_EXPORTED_RUNTIME_METHODS (see the FAQ)") };
if (!Module["UTF16ToString"]) Module["UTF16ToString"] = function() { abort("'UTF16ToString' was not exported. add it to EXTRA_EXPORTED_RUNTIME_METHODS (see the FAQ)") };
if (!Module["stringToUTF16"]) Module["stringToUTF16"] = function() { abort("'stringToUTF16' was not exported. add it to EXTRA_EXPORTED_RUNTIME_METHODS (see the FAQ)") };
if (!Module["lengthBytesUTF16"]) Module["lengthBytesUTF16"] = function() { abort("'lengthBytesUTF16' was not exported. add it to EXTRA_EXPORTED_RUNTIME_METHODS (see the FAQ)") };
if (!Module["UTF32ToString"]) Module["UTF32ToString"] = function() { abort("'UTF32ToString' was not exported. add it to EXTRA_EXPORTED_RUNTIME_METHODS (see the FAQ)") };
if (!Module["stringToUTF32"]) Module["stringToUTF32"] = function() { abort("'stringToUTF32' was not exported. add it to EXTRA_EXPORTED_RUNTIME_METHODS (see the FAQ)") };
if (!Module["lengthBytesUTF32"]) Module["lengthBytesUTF32"] = function() { abort("'lengthBytesUTF32' was not exported. add it to EXTRA_EXPORTED_RUNTIME_METHODS (see the FAQ)") };
if (!Module["allocateUTF8"]) Module["allocateUTF8"] = function() { abort("'allocateUTF8' was not exported. add it to EXTRA_EXPORTED_RUNTIME_METHODS (see the FAQ)") };
if (!Module["stackTrace"]) Module["stackTrace"] = function() { abort("'stackTrace' was not exported. add it to EXTRA_EXPORTED_RUNTIME_METHODS (see the FAQ)") };
if (!Module["addOnPreRun"]) Module["addOnPreRun"] = function() { abort("'addOnPreRun' was not exported. add it to EXTRA_EXPORTED_RUNTIME_METHODS (see the FAQ)") };
if (!Module["addOnInit"]) Module["addOnInit"] = function() { abort("'addOnInit' was not exported. add it to EXTRA_EXPORTED_RUNTIME_METHODS (see the FAQ)") };
if (!Module["addOnPreMain"]) Module["addOnPreMain"] = function() { abort("'addOnPreMain' was not exported. add it to EXTRA_EXPORTED_RUNTIME_METHODS (see the FAQ)") };
if (!Module["addOnExit"]) Module["addOnExit"] = function() { abort("'addOnExit' was not exported. add it to EXTRA_EXPORTED_RUNTIME_METHODS (see the FAQ)") };
if (!Module["addOnPostRun"]) Module["addOnPostRun"] = function() { abort("'addOnPostRun' was not exported. add it to EXTRA_EXPORTED_RUNTIME_METHODS (see the FAQ)") };
if (!Module["writeStringToMemory"]) Module["writeStringToMemory"] = function() { abort("'writeStringToMemory' was not exported. add it to EXTRA_EXPORTED_RUNTIME_METHODS (see the FAQ)") };
if (!Module["writeArrayToMemory"]) Module["writeArrayToMemory"] = function() { abort("'writeArrayToMemory' was not exported. add it to EXTRA_EXPORTED_RUNTIME_METHODS (see the FAQ)") };
if (!Module["writeAsciiToMemory"]) Module["writeAsciiToMemory"] = function() { abort("'writeAsciiToMemory' was not exported. add it to EXTRA_EXPORTED_RUNTIME_METHODS (see the FAQ)") };
if (!Module["addRunDependency"]) Module["addRunDependency"] = function() { abort("'addRunDependency' was not exported. add it to EXTRA_EXPORTED_RUNTIME_METHODS (see the FAQ). Alternatively, forcing filesystem support (-s FORCE_FILESYSTEM=1) can export this for you") };
if (!Module["removeRunDependency"]) Module["removeRunDependency"] = function() { abort("'removeRunDependency' was not exported. add it to EXTRA_EXPORTED_RUNTIME_METHODS (see the FAQ). Alternatively, forcing filesystem support (-s FORCE_FILESYSTEM=1) can export this for you") };
if (!Module["FS"]) Module["FS"] = function() { abort("'FS' was not exported. add it to EXTRA_EXPORTED_RUNTIME_METHODS (see the FAQ)") };
if (!Module["FS_createFolder"]) Module["FS_createFolder"] = function() { abort("'FS_createFolder' was not exported. add it to EXTRA_EXPORTED_RUNTIME_METHODS (see the FAQ). Alternatively, forcing filesystem support (-s FORCE_FILESYSTEM=1) can export this for you") };
if (!Module["FS_createPath"]) Module["FS_createPath"] = function() { abort("'FS_createPath' was not exported. add it to EXTRA_EXPORTED_RUNTIME_METHODS (see the FAQ). Alternatively, forcing filesystem support (-s FORCE_FILESYSTEM=1) can export this for you") };
if (!Module["FS_createDataFile"]) Module["FS_createDataFile"] = function() { abort("'FS_createDataFile' was not exported. add it to EXTRA_EXPORTED_RUNTIME_METHODS (see the FAQ). Alternatively, forcing filesystem support (-s FORCE_FILESYSTEM=1) can export this for you") };
if (!Module["FS_createPreloadedFile"]) Module["FS_createPreloadedFile"] = function() { abort("'FS_createPreloadedFile' was not exported. add it to EXTRA_EXPORTED_RUNTIME_METHODS (see the FAQ). Alternatively, forcing filesystem support (-s FORCE_FILESYSTEM=1) can export this for you") };
if (!Module["FS_createLazyFile"]) Module["FS_createLazyFile"] = function() { abort("'FS_createLazyFile' was not exported. add it to EXTRA_EXPORTED_RUNTIME_METHODS (see the FAQ). Alternatively, forcing filesystem support (-s FORCE_FILESYSTEM=1) can export this for you") };
if (!Module["FS_createLink"]) Module["FS_createLink"] = function() { abort("'FS_createLink' was not exported. add it to EXTRA_EXPORTED_RUNTIME_METHODS (see the FAQ). Alternatively, forcing filesystem support (-s FORCE_FILESYSTEM=1) can export this for you") };
if (!Module["FS_createDevice"]) Module["FS_createDevice"] = function() { abort("'FS_createDevice' was not exported. add it to EXTRA_EXPORTED_RUNTIME_METHODS (see the FAQ). Alternatively, forcing filesystem support (-s FORCE_FILESYSTEM=1) can export this for you") };
if (!Module["FS_unlink"]) Module["FS_unlink"] = function() { abort("'FS_unlink' was not exported. add it to EXTRA_EXPORTED_RUNTIME_METHODS (see the FAQ). Alternatively, forcing filesystem support (-s FORCE_FILESYSTEM=1) can export this for you") };
if (!Module["GL"]) Module["GL"] = function() { abort("'GL' was not exported. add it to EXTRA_EXPORTED_RUNTIME_METHODS (see the FAQ)") };
if (!Module["staticAlloc"]) Module["staticAlloc"] = function() { abort("'staticAlloc' was not exported. add it to EXTRA_EXPORTED_RUNTIME_METHODS (see the FAQ)") };
if (!Module["dynamicAlloc"]) Module["dynamicAlloc"] = function() { abort("'dynamicAlloc' was not exported. add it to EXTRA_EXPORTED_RUNTIME_METHODS (see the FAQ)") };
if (!Module["warnOnce"]) Module["warnOnce"] = function() { abort("'warnOnce' was not exported. add it to EXTRA_EXPORTED_RUNTIME_METHODS (see the FAQ)") };
if (!Module["loadDynamicLibrary"]) Module["loadDynamicLibrary"] = function() { abort("'loadDynamicLibrary' was not exported. add it to EXTRA_EXPORTED_RUNTIME_METHODS (see the FAQ)") };
if (!Module["loadWebAssemblyModule"]) Module["loadWebAssemblyModule"] = function() { abort("'loadWebAssemblyModule' was not exported. add it to EXTRA_EXPORTED_RUNTIME_METHODS (see the FAQ)") };
if (!Module["getLEB"]) Module["getLEB"] = function() { abort("'getLEB' was not exported. add it to EXTRA_EXPORTED_RUNTIME_METHODS (see the FAQ)") };
if (!Module["getFunctionTables"]) Module["getFunctionTables"] = function() { abort("'getFunctionTables' was not exported. add it to EXTRA_EXPORTED_RUNTIME_METHODS (see the FAQ)") };
if (!Module["alignFunctionTables"]) Module["alignFunctionTables"] = function() { abort("'alignFunctionTables' was not exported. add it to EXTRA_EXPORTED_RUNTIME_METHODS (see the FAQ)") };
if (!Module["registerFunctions"]) Module["registerFunctions"] = function() { abort("'registerFunctions' was not exported. add it to EXTRA_EXPORTED_RUNTIME_METHODS (see the FAQ)") };
if (!Module["addFunction"]) Module["addFunction"] = function() { abort("'addFunction' was not exported. add it to EXTRA_EXPORTED_RUNTIME_METHODS (see the FAQ)") };
if (!Module["removeFunction"]) Module["removeFunction"] = function() { abort("'removeFunction' was not exported. add it to EXTRA_EXPORTED_RUNTIME_METHODS (see the FAQ)") };
if (!Module["getFuncWrapper"]) Module["getFuncWrapper"] = function() { abort("'getFuncWrapper' was not exported. add it to EXTRA_EXPORTED_RUNTIME_METHODS (see the FAQ)") };
if (!Module["prettyPrint"]) Module["prettyPrint"] = function() { abort("'prettyPrint' was not exported. add it to EXTRA_EXPORTED_RUNTIME_METHODS (see the FAQ)") };
if (!Module["makeBigInt"]) Module["makeBigInt"] = function() { abort("'makeBigInt' was not exported. add it to EXTRA_EXPORTED_RUNTIME_METHODS (see the FAQ)") };
if (!Module["dynCall"]) Module["dynCall"] = function() { abort("'dynCall' was not exported. add it to EXTRA_EXPORTED_RUNTIME_METHODS (see the FAQ)") };
if (!Module["getCompilerSetting"]) Module["getCompilerSetting"] = function() { abort("'getCompilerSetting' was not exported. add it to EXTRA_EXPORTED_RUNTIME_METHODS (see the FAQ)") };
if (!Module["stackSave"]) Module["stackSave"] = function() { abort("'stackSave' was not exported. add it to EXTRA_EXPORTED_RUNTIME_METHODS (see the FAQ)") };
if (!Module["stackRestore"]) Module["stackRestore"] = function() { abort("'stackRestore' was not exported. add it to EXTRA_EXPORTED_RUNTIME_METHODS (see the FAQ)") };
if (!Module["stackAlloc"]) Module["stackAlloc"] = function() { abort("'stackAlloc' was not exported. add it to EXTRA_EXPORTED_RUNTIME_METHODS (see the FAQ)") };
if (!Module["establishStackSpace"]) Module["establishStackSpace"] = function() { abort("'establishStackSpace' was not exported. add it to EXTRA_EXPORTED_RUNTIME_METHODS (see the FAQ)") };
if (!Module["print"]) Module["print"] = function() { abort("'print' was not exported. add it to EXTRA_EXPORTED_RUNTIME_METHODS (see the FAQ)") };
if (!Module["printErr"]) Module["printErr"] = function() { abort("'printErr' was not exported. add it to EXTRA_EXPORTED_RUNTIME_METHODS (see the FAQ)") };if (!Module["ALLOC_NORMAL"]) Object.defineProperty(Module, "ALLOC_NORMAL", { get: function() { abort("'ALLOC_NORMAL' was not exported. add it to EXTRA_EXPORTED_RUNTIME_METHODS (see the FAQ)") } });
if (!Module["ALLOC_STACK"]) Object.defineProperty(Module, "ALLOC_STACK", { get: function() { abort("'ALLOC_STACK' was not exported. add it to EXTRA_EXPORTED_RUNTIME_METHODS (see the FAQ)") } });
if (!Module["ALLOC_STATIC"]) Object.defineProperty(Module, "ALLOC_STATIC", { get: function() { abort("'ALLOC_STATIC' was not exported. add it to EXTRA_EXPORTED_RUNTIME_METHODS (see the FAQ)") } });
if (!Module["ALLOC_DYNAMIC"]) Object.defineProperty(Module, "ALLOC_DYNAMIC", { get: function() { abort("'ALLOC_DYNAMIC' was not exported. add it to EXTRA_EXPORTED_RUNTIME_METHODS (see the FAQ)") } });
if (!Module["ALLOC_NONE"]) Object.defineProperty(Module, "ALLOC_NONE", { get: function() { abort("'ALLOC_NONE' was not exported. add it to EXTRA_EXPORTED_RUNTIME_METHODS (see the FAQ)") } });

if (memoryInitializer) {
  if (!isDataURI(memoryInitializer)) {
    if (typeof Module['locateFile'] === 'function') {
      memoryInitializer = Module['locateFile'](memoryInitializer);
    } else if (Module['memoryInitializerPrefixURL']) {
      memoryInitializer = Module['memoryInitializerPrefixURL'] + memoryInitializer;
    }
  }
  if (ENVIRONMENT_IS_NODE || ENVIRONMENT_IS_SHELL) {
    var data = Module['readBinary'](memoryInitializer);
    HEAPU8.set(data, GLOBAL_BASE);
  } else {
    addRunDependency('memory initializer');
    var applyMemoryInitializer = function(data) {
      if (data.byteLength) data = new Uint8Array(data);
      for (var i = 0; i < data.length; i++) {
        assert(HEAPU8[GLOBAL_BASE + i] === 0, "area for memory initializer should not have been touched before it's loaded");
      }
      HEAPU8.set(data, GLOBAL_BASE);
      // Delete the typed array that contains the large blob of the memory initializer request response so that
      // we won't keep unnecessary memory lying around. However, keep the XHR object itself alive so that e.g.
      // its .status field can still be accessed later.
      if (Module['memoryInitializerRequest']) delete Module['memoryInitializerRequest'].response;
      removeRunDependency('memory initializer');
    }
    function doBrowserLoad() {
      Module['readAsync'](memoryInitializer, applyMemoryInitializer, function() {
        throw 'could not load memory initializer ' + memoryInitializer;
      });
    }
    if (Module['memoryInitializerRequest']) {
      // a network request has already been created, just use that
      function useRequest() {
        var request = Module['memoryInitializerRequest'];
        var response = request.response;
        if (request.status !== 200 && request.status !== 0) {
            // If you see this warning, the issue may be that you are using locateFile or memoryInitializerPrefixURL, and defining them in JS. That
            // means that the HTML file doesn't know about them, and when it tries to create the mem init request early, does it to the wrong place.
            // Look in your browser's devtools network console to see what's going on.
            console.warn('a problem seems to have happened with Module.memoryInitializerRequest, status: ' + request.status + ', retrying ' + memoryInitializer);
            doBrowserLoad();
            return;
        }
        applyMemoryInitializer(response);
      }
      if (Module['memoryInitializerRequest'].response) {
        setTimeout(useRequest, 0); // it's already here; but, apply it asynchronously
      } else {
        Module['memoryInitializerRequest'].addEventListener('load', useRequest); // wait for it
      }
    } else {
      // fetch it from the network ourselves
      doBrowserLoad();
    }
  }
}



/**
 * @constructor
 * @extends {Error}
 * @this {ExitStatus}
 */
function ExitStatus(status) {
  this.name = "ExitStatus";
  this.message = "Program terminated with exit(" + status + ")";
  this.status = status;
};
ExitStatus.prototype = new Error();
ExitStatus.prototype.constructor = ExitStatus;

var initialStackTop;
var calledMain = false;

dependenciesFulfilled = function runCaller() {
  // If run has never been called, and we should call run (INVOKE_RUN is true, and Module.noInitialRun is not false)
  if (!Module['calledRun']) run();
  if (!Module['calledRun']) dependenciesFulfilled = runCaller; // try this again later, after new deps are fulfilled
}





/** @type {function(Array=)} */
function run(args) {
  args = args || Module['arguments'];

  if (runDependencies > 0) {
    return;
  }

  writeStackCookie();

  preRun();

  if (runDependencies > 0) return; // a preRun added a dependency, run will be called later
  if (Module['calledRun']) return; // run may have just been called through dependencies being fulfilled just in this very frame

  function doRun() {
    if (Module['calledRun']) return; // run may have just been called while the async setStatus time below was happening
    Module['calledRun'] = true;

    if (ABORT) return;

    ensureInitRuntime();

    preMain();

    if (Module['onRuntimeInitialized']) Module['onRuntimeInitialized']();

    assert(!Module['_main'], 'compiled without a main, but one is present. if you added it from JS, use Module["onRuntimeInitialized"]');

    postRun();
  }

  if (Module['setStatus']) {
    Module['setStatus']('Running...');
    setTimeout(function() {
      setTimeout(function() {
        Module['setStatus']('');
      }, 1);
      doRun();
    }, 1);
  } else {
    doRun();
  }
  checkStackCookie();
}
Module['run'] = run;

function checkUnflushedContent() {
  // Compiler settings do not allow exiting the runtime, so flushing
  // the streams is not possible. but in ASSERTIONS mode we check
  // if there was something to flush, and if so tell the user they
  // should request that the runtime be exitable.
  // Normally we would not even include flush() at all, but in ASSERTIONS
  // builds we do so just for this check, and here we see if there is any
  // content to flush, that is, we check if there would have been
  // something a non-ASSERTIONS build would have not seen.
  // How we flush the streams depends on whether we are in NO_FILESYSTEM
  // mode (which has its own special function for this; otherwise, all
  // the code is inside libc)
  var print = out;
  var printErr = err;
  var has = false;
  out = err = function(x) {
    has = true;
  }
  try { // it doesn't matter if it fails
    var flush = flush_NO_FILESYSTEM;
    if (flush) flush(0);
  } catch(e) {}
  out = print;
  err = printErr;
  if (has) {
    warnOnce('stdio streams had content in them that was not flushed. you should set NO_EXIT_RUNTIME to 0 (see the FAQ), or make sure to emit a newline when you printf etc.');
  }
}

function exit(status, implicit) {
  checkUnflushedContent();

  // if this is just main exit-ing implicitly, and the status is 0, then we
  // don't need to do anything here and can just leave. if the status is
  // non-zero, though, then we need to report it.
  // (we may have warned about this earlier, if a situation justifies doing so)
  if (implicit && Module['noExitRuntime'] && status === 0) {
    return;
  }

  if (Module['noExitRuntime']) {
    // if exit() was called, we may warn the user if the runtime isn't actually being shut down
    if (!implicit) {
      err('exit(' + status + ') called, but NO_EXIT_RUNTIME is set, so halting execution but not exiting the runtime or preventing further async execution (build with NO_EXIT_RUNTIME=0, if you want a true shutdown)');
    }
  } else {

    ABORT = true;
    EXITSTATUS = status;
    STACKTOP = initialStackTop;

    exitRuntime();

    if (Module['onExit']) Module['onExit'](status);
  }

  Module['quit'](status, new ExitStatus(status));
}

var abortDecorators = [];

function abort(what) {
  if (Module['onAbort']) {
    Module['onAbort'](what);
  }

  if (what !== undefined) {
    out(what);
    err(what);
    what = JSON.stringify(what)
  } else {
    what = '';
  }

  ABORT = true;
  EXITSTATUS = 1;

  var extra = '';
  var output = 'abort(' + what + ') at ' + stackTrace() + extra;
  if (abortDecorators) {
    abortDecorators.forEach(function(decorator) {
      output = decorator(output, what);
    });
  }
  throw output;
}
Module['abort'] = abort;

// {{PRE_RUN_ADDITIONS}}

if (Module['preInit']) {
  if (typeof Module['preInit'] == 'function') Module['preInit'] = [Module['preInit']];
  while (Module['preInit'].length > 0) {
    Module['preInit'].pop()();
  }
}


Module["noExitRuntime"] = true;

run();

// {{POST_RUN_ADDITIONS}}





// {{MODULE_ADDITIONS}}



//# sourceMappingURL=nstrumenta.js.map
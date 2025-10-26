'use strict';
function get_unzstd(cont)
{
    let mem8;
    function __abort(strptr)
    {
        throw new Error('wasm abort: ' + get_string(strptr));
    }

    function dummy()
    {
        throw new Error('wasm error');
    }

    const funcs = [
        "exit",
        "__get_mticks",
        "__console_print",
        "__filestore_fetch",
        "__open_get_size",
        "__open",
        "__read",
        "__write",
        "__close",
        "sin",
        "cos",
        "pow",
        "log10",
        "log2",
        "tan",
        "atan2",
        "round",
    ];

    const imports = {
        env: {
            __abort,
        }
    };

    for (let i = 0; i < funcs.length; i++)
        imports.env[funcs[i]] = dummy;

    const fetchopt = { cache: 'default' };

    fetch('unzstd.wasm', fetchopt)
        .then(response => response.arrayBuffer())
        .then(bytes => WebAssembly.compile(bytes))
        .then(module => new WebAssembly.Instance(module, imports))
        .then(instance => {
            instance.exports.memory.grow(1024 * 10); // 64K * 10K
            mem8 = new Uint8Array(instance.exports.memory.buffer);
            function unzstd(abuf) {
                const buf = new Uint8Array(abuf);
                const srcptr = instance.exports.malloc(buf.length);
                for (let i = 0; i < buf.length; i++)
                    mem8[srcptr + i] = buf[i];
                const dstlen = Number(instance.exports.ZSTD_decompressBound(srcptr, buf.length));
                const dstptr = instance.exports.malloc(dstlen);
                const dstlen2 = Number(instance.exports.ZSTD_decompress(dstptr, dstlen,
                                                                        srcptr, buf.length));
                // todo: error
                const abufo = new ArrayBuffer(dstlen2);
                const bufo = new Uint8Array(abufo);
                for (let i = 0; i < dstlen2; i++)
                    bufo[i] = mem8[dstptr + i];
                return abufo;
            }
            cont(unzstd);
        });
}

'use strict';
function get_unzstd(cont)
{
    let mem8;

    const imports = {
        env: {}
    };

    const fetchopt = { cache: 'default' };

    fetch('unzstd.wasm', fetchopt)
        .then(response => response.arrayBuffer())
        .then(bytes => WebAssembly.compile(bytes))
        .then(module => new WebAssembly.Instance(module, imports))
        .then(instance => {
            const exp = instance.exports;
            const CHUNK_SIZE = 1024 * 1024;
            exp.memory.grow(2048 + 64);

            const dctx = exp.ZSTD_createDCtx();
            const srcptr = exp.malloc(CHUNK_SIZE);
            const dstptr = exp.malloc(CHUNK_SIZE);
            const structptr = exp.malloc(24);

            mem8 = new Uint8Array(exp.memory.buffer);

            function unzstd(abuf) {
                const buf = new Uint8Array(abuf);
                const chunks = [];
                let total_out_len = 0;
                let in_pos_global = 0;

                const view = new DataView(exp.memory.buffer);
                const inStruct = structptr;
                const outStruct = structptr + 12;

                while (in_pos_global < buf.length) {
                    const in_len = Math.min(buf.length - in_pos_global, CHUNK_SIZE);
                    mem8.set(buf.subarray(in_pos_global, in_pos_global + in_len), srcptr);
                    in_pos_global += in_len;

                    view.setUint32(inStruct + 0, srcptr, true);
                    view.setUint32(inStruct + 4, in_len, true);
                    view.setUint32(inStruct + 8, 0, true);

                    while (view.getUint32(inStruct + 8, true) < in_len) {
                        view.setUint32(outStruct + 0, dstptr, true);
                        view.setUint32(outStruct + 4, CHUNK_SIZE, true);
                        view.setUint32(outStruct + 8, 0, true);

                        const ret = exp.ZSTD_decompressStream(dctx, outStruct, inStruct);
                        if (exp.ZSTD_isError(ret)) {
                            throw new Error("ZSTD decompression failed");
                        }

                        const out_pos = view.getUint32(outStruct + 8, true);
                        if (out_pos > 0) {
                            const chunk = mem8.slice(dstptr, dstptr + out_pos);
                            chunks.push(chunk);
                            total_out_len += out_pos;
                        }

                        if (out_pos === 0) break;
                    }
                }

                const abufo = new ArrayBuffer(total_out_len);
                const bufo = new Uint8Array(abufo);
                let offset = 0;
                for (const chunk of chunks) {
                    bufo.set(chunk, offset);
                    offset += chunk.length;
                }

                return abufo;
            }
            cont(unzstd);
        });
}

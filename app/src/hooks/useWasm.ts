import { useState, useEffect } from "react";
import { initWasm, isWasmReady } from "~/lib/wasm";

/**
 * Hook to ensure WASM module is initialized before use.
 * Returns `true` once the WASM module is ready.
 */
export function useWasm(): boolean {
  const [ready, setReady] = useState(isWasmReady);

  useEffect(() => {
    if (!ready) {
      initWasm().then(() => setReady(true));
    }
  }, [ready]);

  return ready;
}

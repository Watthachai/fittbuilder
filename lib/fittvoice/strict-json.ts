/**
 * JSON.parse, plus the rejections the delivery contract asks for and JSON.parse
 * does not make.
 *
 * The contentHash is computed over the parsed value, so anything JSON.parse
 * quietly smooths over changes what was hashed: of two equal keys it keeps the
 * last, it accepts a lone UTF-16 surrogate, and it rounds an integer past 2^53.
 * The sender and the receiver would then be hashing different documents. V1 also
 * carries integers only, so a fraction or an exponent is an error too.
 */
export function parseStrictJson(text: string): unknown {
  let i = 0;
  const fail = (why: string): never => {
    throw new SyntaxError(`${why} (ตำแหน่ง ${i})`);
  };
  const ws = () => {
    while (i < text.length && " \t\n\r".includes(text[i])) i++;
  };
  const expect = (s: string) => {
    if (text.startsWith(s, i)) i += s.length;
    else fail(`ต้องเป็น ${s}`);
  };

  const string = (): string => {
    expect('"');
    let out = "";
    for (;;) {
      if (i >= text.length) fail("สตริงไม่ปิด");
      const c = text[i++];
      if (c === '"') break;
      if (c < " ") fail("อักขระควบคุมในสตริง");
      if (c !== "\\") {
        out += c;
        continue;
      }
      const e = text[i++];
      if (e === "u") {
        const hex = text.slice(i, i + 4);
        if (!/^[0-9a-fA-F]{4}$/.test(hex)) fail("\\u ไม่ถูกต้อง");
        out += String.fromCharCode(parseInt(hex, 16));
        i += 4;
      } else {
        const simple: Record<string, string> = { '"': '"', "\\": "\\", "/": "/", b: "\b", f: "\f", n: "\n", r: "\r", t: "\t" };
        if (!(e in simple)) fail("escape ไม่ถูกต้อง");
        out += simple[e];
      }
    }
    // A high surrogate must be followed by a low one, and a low one preceded by a high.
    for (let k = 0; k < out.length; k++) {
      const u = out.charCodeAt(k);
      if (u >= 0xd800 && u <= 0xdbff) {
        const next = out.charCodeAt(k + 1);
        if (!(next >= 0xdc00 && next <= 0xdfff)) fail("surrogate ไม่ครบคู่");
        k++;
      } else if (u >= 0xdc00 && u <= 0xdfff) fail("surrogate ไม่ครบคู่");
    }
    return out;
  };

  const number = (): number => {
    const m = /^-?(0|[1-9][0-9]*)([.eE])?/.exec(text.slice(i));
    if (!m) fail("ตัวเลขไม่ถูกต้อง");
    if (m![2]) fail("V1 รับเฉพาะจำนวนเต็ม");
    i += m![0].length;
    const n = Number(m![0]);
    if (!Number.isSafeInteger(n)) fail("ตัวเลขเกิน safe integer");
    return n;
  };

  const value = (): unknown => {
    ws();
    const c = text[i];
    if (c === "{") {
      i++;
      const obj: Record<string, unknown> = {};
      ws();
      if (text[i] === "}") {
        i++;
        return obj;
      }
      for (;;) {
        ws();
        const key = string();
        if (Object.prototype.hasOwnProperty.call(obj, key)) fail(`ชื่อ property ซ้ำ "${key}"`);
        ws();
        expect(":");
        // defineProperty, not assignment: a "__proto__" key is data, not the prototype.
        Object.defineProperty(obj, key, { value: value(), enumerable: true, writable: true, configurable: true });
        ws();
        if (text[i] === ",") i++;
        else if (text[i] === "}") {
          i++;
          return obj;
        } else fail("ต้องเป็น , หรือ }");
      }
    }
    if (c === "[") {
      i++;
      const arr: unknown[] = [];
      ws();
      if (text[i] === "]") {
        i++;
        return arr;
      }
      for (;;) {
        arr.push(value());
        ws();
        if (text[i] === ",") i++;
        else if (text[i] === "]") {
          i++;
          return arr;
        } else fail("ต้องเป็น , หรือ ]");
      }
    }
    if (c === '"') return string();
    if (text.startsWith("true", i)) return (i += 4), true;
    if (text.startsWith("false", i)) return (i += 5), false;
    if (text.startsWith("null", i)) return (i += 4), null;
    return number();
  };

  const result = value();
  ws();
  if (i !== text.length) fail("มีข้อมูลเกินหลังจบ JSON");
  return result;
}

/**
 * ePayco: firma de la confirmación, montos y lectura de transacciones (sin red, sin llaves reales).
 */
import { createHash } from "node:crypto";
import { describe, expect, it } from "vitest";
import { epaycoInvoice, epaycoOrderNumber, epaycoSignature, epaycoStatus, fromMinorUnits, parseEpaycoTransaction, toMinorUnits, verifyEpaycoSignature } from "@/server/integrations/payments/epayco-protocol";

const keys = { customerId: "900001", pKey: "llave_p_de_prueba" };
const cfg = { customerId: "900001", testMode: false };

function confirmation(over: Record<string, string> = {}) {
  const base: Record<string, string> = {
    x_cust_id_cliente: "900001",
    x_ref_payco: "123456789",
    x_transaction_id: "998877",
    x_amount: "7.99",
    x_currency_code: "USD",
    x_cod_response: "1",
    x_extra1: "VX-ABCD-EFGH",
    x_id_invoice: "VX-ABCD-EFGH-mabc12",
    x_franchise: "VS",
    x_test_request: "FALSE",
    ...over,
  };
  if (!("x_signature" in over)) {
    base.x_signature = epaycoSignature({ ...keys, refPayco: base.x_ref_payco, transactionId: base.x_transaction_id, amount: base.x_amount, currency: base.x_currency_code });
  }
  return base;
}

describe("firma de la confirmación de ePayco", () => {
  it("es SHA-256 de «cliente^p_key^ref^transacción^monto^moneda»", () => {
    const expected = createHash("sha256").update("900001^llave_p_de_prueba^123^456^25000^COP").digest("hex");
    expect(epaycoSignature({ ...keys, refPayco: "123", transactionId: "456", amount: "25000", currency: "COP" })).toBe(expected);
  });

  it("acepta la firma correcta (también en mayúsculas)", () => {
    const c = confirmation();
    expect(verifyEpaycoSignature(c, keys)).toBe(true);
    expect(verifyEpaycoSignature({ ...c, x_signature: c.x_signature.toUpperCase() }, keys)).toBe(true);
  });

  it("rechaza firmas de otra llave, montos o monedas alterados y datos faltantes", () => {
    const c = confirmation();
    expect(verifyEpaycoSignature(c, { ...keys, pKey: "otra" })).toBe(false);
    expect(verifyEpaycoSignature({ ...c, x_amount: "0.99" }, keys)).toBe(false);
    expect(verifyEpaycoSignature({ ...c, x_currency_code: "COP" }, keys)).toBe(false);
    expect(verifyEpaycoSignature({ ...c, x_ref_payco: "1" }, keys)).toBe(false);
    expect(verifyEpaycoSignature({ ...c, x_signature: "" }, keys)).toBe(false);
    expect(verifyEpaycoSignature(c, { customerId: "", pKey: "" })).toBe(false);
  });
});

describe("montos de ePayco", () => {
  it("convierte dólares a centavos y pesos a enteros", () => {
    expect(toMinorUnits("7.99", "USD")).toBe(799);
    expect(toMinorUnits("0.29", "USD")).toBe(29);
    expect(toMinorUnits(45.39, "usd")).toBe(4539);
    expect(toMinorUnits("25000", "COP")).toBe(25000);
    expect(toMinorUnits("25000.00", "COP")).toBe(25000);
    expect(toMinorUnits("", "COP")).toBeNaN();
    expect(toMinorUnits("abc", "USD")).toBeNaN();
    expect(toMinorUnits("-5", "USD")).toBeNaN();
  });

  it("envía los montos con el formato de ePayco", () => {
    expect(fromMinorUnits(799, "USD")).toBe("7.99");
    expect(fromMinorUnits(1000, "USD")).toBe("10.00");
    expect(fromMinorUnits(25000, "COP")).toBe("25000");
  });
});

describe("transacciones de ePayco", () => {
  it("factura única por intento y número de pedido recuperable", () => {
    const inv = epaycoInvoice("VX-ABCD-EFGH", 1_700_000_000_000);
    expect(inv.startsWith("VX-ABCD-EFGH-")).toBe(true);
    expect(epaycoInvoice("VX-ABCD-EFGH", 1)).not.toBe(epaycoInvoice("VX-ABCD-EFGH", 2));
    expect(epaycoOrderNumber(null, inv)).toBe("VX-ABCD-EFGH");
    expect(epaycoOrderNumber("VX-ABCD-EFGH", "otra-cosa")).toBe("VX-ABCD-EFGH");
    expect(epaycoOrderNumber("", "sin-sufijo")).toBeNull();
  });

  it("estados: aceptada, rechazada, pendiente, reversada y desconocidos", () => {
    expect(epaycoStatus("1")).toBe("APPROVED");
    expect(epaycoStatus(2)).toBe("DECLINED");
    expect(epaycoStatus("3")).toBe("PENDING");
    expect(epaycoStatus("4")).toBe("ERROR");
    expect(epaycoStatus("6")).toBe("VOIDED");
    expect(epaycoStatus("12")).toBe("DECLINED");
    expect(epaycoStatus("99")).toBe("PENDING");
  });

  it("lee una transacción de nuestro comercio", () => {
    expect(parseEpaycoTransaction(confirmation(), cfg)).toEqual({ providerRef: "123456789", reference: "VX-ABCD-EFGH", status: "APPROVED", amount: 799, currency: "USD", method: "VISA" });
    // La consulta de ePayco devuelve números (no texto): se aceptan igual.
    expect(parseEpaycoTransaction({ ...confirmation(), x_cust_id_cliente: 900001, x_ref_payco: 123456789, x_amount: 25000, x_currency_code: "COP", x_cod_response: 1 }, cfg)?.amount).toBe(25000);
  });

  it("ignora cobros de OTRO comercio con nuestro número de pedido (la consulta de ePayco es pública)", () => {
    expect(parseEpaycoTransaction(confirmation({ x_cust_id_cliente: "123" }), cfg)).toBeNull();
    expect(parseEpaycoTransaction(confirmation(), { ...cfg, customerId: "" })).toBeNull();
  });

  it("en producción ignora transacciones de prueba; en modo pruebas las acepta", () => {
    expect(parseEpaycoTransaction(confirmation({ x_test_request: "TRUE" }), cfg)).toBeNull();
    expect(parseEpaycoTransaction(confirmation({ x_test_request: "TRUE" }), { ...cfg, testMode: true })?.status).toBe("APPROVED");
  });

  it("descarta transacciones sin referencia, pedido, moneda o monto", () => {
    expect(parseEpaycoTransaction(confirmation({ x_ref_payco: "" }), cfg)).toBeNull();
    expect(parseEpaycoTransaction(confirmation({ x_extra1: "", x_id_invoice: "" }), cfg)).toBeNull();
    expect(parseEpaycoTransaction(confirmation({ x_currency_code: "" }), cfg)).toBeNull();
    expect(parseEpaycoTransaction(confirmation({ x_amount: "n/a" }), cfg)).toBeNull();
  });
});

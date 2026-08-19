import "@testing-library/jest-dom/vitest";
import { cleanup } from "@testing-library/react";
import { afterEach } from "vitest";

class ResizeObserverMock {
  observe() {}
  unobserve() {}
  disconnect() {}
}
Object.defineProperty(globalThis, "ResizeObserver", { value: ResizeObserverMock });
Object.defineProperty(URL, "createObjectURL", { value: () => "blob:demo" });
Object.defineProperty(URL, "revokeObjectURL", { value: () => undefined });
afterEach(() => cleanup());

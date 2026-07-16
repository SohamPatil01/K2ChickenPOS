// The store shell now lives in ./shell (glass redesign). This re-export
// keeps every existing `import StoreLayout from "@/components/StoreLayout"`
// call site working unchanged.
export { default } from "./shell/StoreShell";

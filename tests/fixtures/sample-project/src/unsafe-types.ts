// This file has intentional type safety issues for testing

interface User {
  name: string;
  age: number;
}

// Several `: any` annotations
function processData(input: any): any {
  const result: any = input.transform();
  return result;
}

function handleEvent(event: any) {
  console.log(event);
}

// `as any` casts
const config = getConfig() as any;
const value = (window as any).customProperty;

// @ts-ignore
const broken = undeclaredVariable + 1;

// A variable named company (should NOT be flagged)
const company = "Acme Corp";
const manyThings = [1, 2, 3];

function getCompanyName(): string {
  return company;
}

export { processData, handleEvent, config, value, company, manyThings };

import { test } from "node:test";
import assert from "node:assert/strict";
import { consumeStamina } from "../src/services/stamina-usage.js";

test("work spends exactly four stamina in a minute",()=>{assert.deepEqual(consumeStamina(120,0,60000),{stamina:116,staminaUsageUnits:0});});
test("the first point is spent only after fifteen accumulated work seconds",()=>{const before=consumeStamina(120,0,14000);assert.deepEqual(before,{stamina:120,staminaUsageUnits:56000});assert.deepEqual(consumeStamina(before.stamina,before.staminaUsageUnits,1000),{stamina:119,staminaUsageUnits:0});});
test("frequent ticks and a single offline interval spend the same amount",()=>{let row={stamina:120,staminaUsageUnits:0};for(let i=0;i<60;i++)row=consumeStamina(row.stamina,row.staminaUsageUnits,1000);assert.deepEqual(row,consumeStamina(120,0,60000));});
test("zero elapsed time does not reset partial consumption",()=>{assert.deepEqual(consumeStamina(120,56000,0),{stamina:120,staminaUsageUnits:56000});});
test("exhaustion never makes stamina negative",()=>{assert.deepEqual(consumeStamina(1,0,60000),{stamina:0,staminaUsageUnits:0});});
test("120 stamina lasts thirty minutes of continuous work",()=>{assert.equal(consumeStamina(120,0,1799000).stamina,1);assert.equal(consumeStamina(120,0,1800000).stamina,0);});

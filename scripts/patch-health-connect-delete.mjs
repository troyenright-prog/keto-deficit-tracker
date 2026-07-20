import { readFileSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';

// The upstream Capacitor bridge exposes Health Connect inserts and reads but
// not the Android delete-by-time-range API. Nutrition sync needs deletion so
// an edited daily total replaces the old record instead of double-counting.
const pluginPath = resolve(
  'node_modules/@kiwi-health/capacitor-health-connect/android/src/main/java/com/ubiehealth/capacitor/healthconnect/HealthConnectPlugin.kt',
);
const marker = 'fun deleteNutritionRecords(call: PluginCall)';
const anchor = '    @PluginMethod\n    fun readRecord(call: PluginCall) {';
const method = `    @PluginMethod
    fun deleteNutritionRecords(call: PluginCall) {
        this.activity.lifecycleScope.launch {
            try {
                val startTime = Instant.parse(requireNotNull(call.getString("startTime")))
                val endTime = Instant.parse(requireNotNull(call.getString("endTime")))
                healthConnectClient.deleteRecords(
                    NutritionRecord::class,
                    TimeRangeFilter.between(startTime, endTime),
                )
                call.resolve()
            } catch (error: Exception) {
                call.reject("Could not delete Nutrition records", error)
            }
        }
    }

`;

const source = readFileSync(pluginPath, 'utf8');
if (source.includes(marker)) {
  console.log('Health Connect nutrition-delete bridge already patched.');
} else {
  if (!source.includes(anchor)) {
    throw new Error('Health Connect plugin layout changed; nutrition-delete patch could not be applied.');
  }
  writeFileSync(pluginPath, source.replace(anchor, `${method}${anchor}`));
  console.log('Patched Health Connect nutrition-delete bridge.');
}

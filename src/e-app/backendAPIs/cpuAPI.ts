/*!
 * Copyright (c) 2019-2026 TUXEDO Computers GmbH <tux@tuxedocomputers.com>
 *
 * This file is part of TUXEDO Control Center.
 *
 * TUXEDO Control Center is free software: you can redistribute it and/or modify
 * it under the terms of the GNU General Public License as published by
 * the Free Software Foundation, either version 3 of the License, or
 * (at your option) any later version.
 *
 * TUXEDO Control Center is distributed in the hope that it will be useful,
 * but WITHOUT ANY WARRANTY; without even the implied warranty of
 * MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
 * GNU General Public License for more details.
 *
 * You should have received a copy of the GNU General Public License
 * along with TUXEDO Control Center.  If not, see <https://www.gnu.org/licenses/>.
 */

import type { IpcMainEvent, IpcMainInvokeEvent } from 'electron';
import { ipcMain } from 'electron';
import { CpuController } from '../../common/classes/CpuController';
import { ScalingDriver } from '../../common/classes/LogicalCpuController';
import type { IGeneralCPUInfo, ILogicalCoreInfo } from '../../common/models/ICpuInfos';

const cpu: CpuController = new CpuController('/sys/devices/system/cpu');

// todo: values can most likely be gathered in the cpu worker via onWork() instead to avoid unnecessary duplicated file access
// there already is core.scalingAvailableFrequencies.readValueNT() and this.cpuCtrl.cores[0].cpuinfoMinFreq.readValueNT() for example
// todo: readValueNT() is sync and thus it is an async function which runs sync code
ipcMain.handle('get-general-cpu-info-async', async (_event: IpcMainInvokeEvent): Promise<IGeneralCPUInfo> => {
    try {
        if (!cpu.cores || cpu.cores.length === 0) {
            return undefined;
        }

        const firstCore = cpu.cores[0];
        const scalingDriver: string = firstCore.scalingDriver.isAvailable()
            ? firstCore.scalingDriver.readValueNT()
            : undefined;

        const minFreq: number = firstCore.cpuinfoMinFreq.isAvailable()
            ? firstCore.cpuinfoMinFreq.readValueNT()
            : undefined;

        let maxFreq: number = firstCore.cpuinfoMaxFreq.isAvailable()
            ? firstCore.cpuinfoMaxFreq.readValueNT()
            : undefined;

        let scalingAvailableFrequencies: number[] = firstCore.scalingAvailableFrequencies.isAvailable()
            ? firstCore.scalingAvailableFrequencies.readValueNT()
            : undefined;

        const scalingAvailableGovernors: string[] = firstCore.scalingAvailableGovernors.isAvailable()
            ? firstCore.scalingAvailableGovernors.readValueNT()
            : undefined;

        const energyPerformanceAvailablePreferences: string[] =
            firstCore.energyPerformanceAvailablePreferences.isAvailable()
                ? firstCore.energyPerformanceAvailablePreferences.readValueNT()
                : undefined;

        const boost: boolean = cpu.boost.isAvailable() ? cpu.boost.readValueNT() : undefined;

        if (scalingAvailableFrequencies !== undefined && scalingAvailableFrequencies.length > 0) {
            maxFreq = scalingAvailableFrequencies[0];
        }

        if (boost !== undefined && scalingDriver === ScalingDriver.acpi_cpufreq && maxFreq !== undefined) {
            // FIXME: Use actual max boost frequency
            maxFreq += 1000000;
            scalingAvailableFrequencies = [maxFreq].concat(scalingAvailableFrequencies || []);
        }

        const cpuInfo: IGeneralCPUInfo = {
            availableCores: cpu.cores.length,
            minFreq: minFreq,
            maxFreq: maxFreq,
            scalingAvailableFrequencies: scalingAvailableFrequencies,
            scalingAvailableGovernors: scalingAvailableGovernors,
            energyPerformanceAvailablePreferences: energyPerformanceAvailablePreferences,
            reducedAvailableFreq: firstCore.getReducedAvailableFreqNT(),
            boost: boost,
        };

        return cpuInfo;
    } catch (err: unknown) {
        console.error(`cpuAPI: get-general-cpu-info-async failed => ${err}`);
        return undefined;
    }
});

ipcMain.handle('get-logical-core-info-async', async (_event: IpcMainInvokeEvent): Promise<ILogicalCoreInfo[]> => {
    try {
        const coreInfoList: ILogicalCoreInfo[] = [];

        if (!cpu.cores) {
            return coreInfoList;
        }

        for (const core of cpu.cores) {
            try {
                let onlineStatus: boolean = true;
                if (core.coreIndex !== 0 && core.online.isAvailable()) {
                    onlineStatus = core.online.readValueNT() ?? false;
                }

                if (!onlineStatus) {
                    continue;
                }

                const scalingCurFreq: number = core.scalingCurFreq.isAvailable()
                    ? core.scalingCurFreq.readValueNT()
                    : undefined;

                const scalingMinFreq: number = core.scalingMinFreq.isAvailable()
                    ? core.scalingMinFreq.readValueNT()
                    : undefined;

                const scalingMaxFreq: number = core.scalingMaxFreq.isAvailable()
                    ? core.scalingMaxFreq.readValueNT()
                    : undefined;

                const scalingDriver: string = core.scalingDriver.isAvailable()
                    ? core.scalingDriver.readValueNT()
                    : undefined;

                const energyPerformanceAvailablePreferences: string[] =
                    core.energyPerformanceAvailablePreferences.isAvailable()
                        ? core.energyPerformanceAvailablePreferences.readValueNT()
                        : undefined;

                const energyPerformancePreference: string = core.energyPerformancePreference.isAvailable()
                    ? core.energyPerformancePreference.readValueNT()
                    : undefined;

                const scalingAvailableGovernors: string[] = core.scalingAvailableGovernors.isAvailable()
                    ? core.scalingAvailableGovernors.readValueNT()
                    : undefined;

                const scalingGovernor: string = core.scalingGovernor.isAvailable()
                    ? core.scalingGovernor.readValueNT()
                    : undefined;

                const cpuInfoMaxFreq: number = core.cpuinfoMaxFreq.isAvailable()
                    ? core.cpuinfoMaxFreq.readValueNT()
                    : undefined;

                const cpuInfoMinFreq: number = core.cpuinfoMinFreq.isAvailable()
                    ? core.cpuinfoMinFreq.readValueNT()
                    : undefined;

                const coreId: number = core.coreId.isAvailable() ? core.coreId.readValueNT() : undefined;

                const coreSiblingsList: number[] = core.coreSiblingsList.isAvailable()
                    ? core.coreSiblingsList.readValueNT()
                    : undefined;

                const physicalPackageId: number = core.physicalPackageId.isAvailable()
                    ? core.physicalPackageId.readValueNT()
                    : undefined;

                const threadSiblingsList: number[] = core.threadSiblingsList.isAvailable()
                    ? core.threadSiblingsList.readValueNT()
                    : undefined;

                const coreInfo: ILogicalCoreInfo = {
                    index: core.coreIndex,
                    online: onlineStatus,
                    scalingCurFreq: scalingCurFreq,
                    scalingMinFreq: scalingMinFreq,
                    scalingMaxFreq: scalingMaxFreq,
                    scalingDriver: scalingDriver,
                    energyPerformanceAvailablePreferences: energyPerformanceAvailablePreferences,
                    energyPerformancePreference: energyPerformancePreference,
                    scalingAvailableGovernors: scalingAvailableGovernors,
                    scalingGovernor: scalingGovernor,
                    cpuInfoMaxFreq: cpuInfoMaxFreq,
                    cpuInfoMinFreq: cpuInfoMinFreq,
                    coreId: coreId,
                    coreSiblingsList: coreSiblingsList,
                    physicalPackageId: physicalPackageId,
                    threadSiblingsList: threadSiblingsList,
                };
                coreInfoList.push(coreInfo);
            } catch (err: unknown) {
                console.error(`cpuAPI: get-logical-core-info-async loop failed for core ${core.coreIndex} => ${err}`);
            }
        }
        return coreInfoList;
    } catch (err: unknown) {
        console.error(`cpuAPI: get-logical-core-info-async failed => ${err}`);
        return [];
    }
});

ipcMain.handle('get-intel-pstate-turbo-value-async', async (_event: IpcMainInvokeEvent): Promise<boolean> => {
    try {
        if (cpu.intelPstate.noTurbo.isAvailable()) {
            return cpu.intelPstate.noTurbo.readValueNT() ?? false;
        }
        return false;
    } catch (err: unknown) {
        console.error(`cpuAPI: get-intel-pstate-turbo-value-async failed => ${err}`);
        return false;
    }
});

ipcMain.on('comp-get-scaling-driver-acpi-cpu-freq-sync', (_event: IpcMainEvent): string => {
    try {
        const scalingDriver: string = ScalingDriver.acpi_cpufreq;
        return scalingDriver;
    } catch (err: unknown) {
        console.error(`cpuApi: comp-get-scaling-driver-acpi-cpu-freq-sync failed => ${err}`);
        throw err;
    }
});

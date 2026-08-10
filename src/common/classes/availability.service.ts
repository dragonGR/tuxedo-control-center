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

import * as fs from 'node:fs';
import * as path from 'node:path';
import type { IDeviceCounts } from '../../common/models/TccGpuValues';
import { amdDGpuDeviceIdString, amdIGpuDeviceIdString } from './AmdDeviceIDs';
import { intelIGpuDeviceIdString } from './IntelDeviceIDs';
import { countLines, execCommandSync } from './Utils';

export class AvailabilityService {
    private iGpuAvailable: boolean = false;
    private dGpuAvailable: boolean = false;
    private intelIGpuDevices: number;
    private amdIGpuDevices: number;
    private amdDGpuDevices: number;
    private nvidiaDevices: number;

    constructor() {
        const devices: IDeviceCounts = this.getDevices();
        this.iGpuAvailable = devices.intelIGpuDevices === 1 || devices.amdIGpuDevices === 1;
        this.dGpuAvailable =
            devices.nvidiaDevices !== devices.amdDGpuDevices &&
            (devices.nvidiaDevices === 1 || devices.amdDGpuDevices === 1);

        this.intelIGpuDevices = devices.intelIGpuDevices;
        this.amdIGpuDevices = devices.amdIGpuDevices;
        this.amdDGpuDevices = devices.amdDGpuDevices;
        this.nvidiaDevices = devices.nvidiaDevices;
    }

    // prime-select is not reliable since it does not check hardware availability or bios settings,
    // looking for DRIVER=nvidia in /sys/bus yields no results if prime-select is in "intel" mode,
    // looking for an intel vendor id is not enough since more devices are from intel, amd iGPU
    // and dGPU both use amdgpu, /var/log/gpu-manager.log only exists in Ubuntu and does not discern
    // amd iGPU and dGPU. As a solution, looking for vendor and product IDs for active pci devices,
    // but some laptops show iGPU when bios is in dGPU mode.
    private getDevices(): IDeviceCounts {
        return {
            intelIGpuDevices: this.countDevicesMatchingPattern(intelIGpuDeviceIdString),
            amdIGpuDevices: this.countDevicesMatchingPattern(amdIGpuDeviceIdString),
            amdDGpuDevices: this.countDevicesMatchingPattern(amdDGpuDeviceIdString),
            nvidiaDevices: this.countNvidiaDevices(),
        };
    }

    private countDevicesMatchingPattern(pattern: string): number {
        const pciDir = '/sys/bus/pci/devices';
        if (!fs.existsSync(pciDir)) {
            return 0;
        }
        try {
            const devices: string[] = fs.readdirSync(pciDir);
            const regex = new RegExp(pattern);
            let count = 0;
            for (const dev of devices) {
                const ueventPath = path.join(pciDir, dev, 'uevent');
                if (fs.existsSync(ueventPath)) {
                    try {
                        const content: string = fs.readFileSync(ueventPath, 'utf8');
                        if (regex.test(content)) {
                            count++;
                        }
                    } catch (_err: unknown) {}
                }
            }
            return count;
        } catch (_err: unknown) {
            return 0;
        }
    }

    private countNvidiaDevices(): number {
        const pciDir = '/sys/bus/pci/devices';
        if (!fs.existsSync(pciDir)) {
            return 0;
        }
        try {
            const devices: string[] = fs.readdirSync(pciDir);
            const distinctBuses = new Set<string>();
            for (const dev of devices) {
                const vendorPath = path.join(pciDir, dev, 'vendor');
                if (fs.existsSync(vendorPath)) {
                    try {
                        const vendorId: string = fs.readFileSync(vendorPath, 'utf8').trim().toLowerCase();
                        if (vendorId === '0x10de') {
                            const dotIndex: number = dev.lastIndexOf('.');
                            const baseDev: string = dotIndex !== -1 ? dev.substring(0, dotIndex) : dev;
                            distinctBuses.add(baseDev);
                        }
                    } catch (_err: unknown) {}
                }
            }
            return distinctBuses.size;
        } catch (_err: unknown) {
            return 0;
        }
    }

    public isIGpuAvailable(): boolean {
        return this.iGpuAvailable;
    }

    public isDGpuAvailable(): boolean {
        return this.dGpuAvailable;
    }

    public getIntelIGpuCount(): number {
        return this.intelIGpuDevices;
    }

    public getAmdIGpuCount(): number {
        return this.amdIGpuDevices;
    }

    public getAmdDGpuCount(): number {
        return this.amdDGpuDevices;
    }

    public getNvidiaDGpuCount(): number {
        return this.nvidiaDevices;
    }
}

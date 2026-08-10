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

import type { IntelRAPLController } from './IntelRAPLController';

export class PowerController {
    private intelRAPL: IntelRAPLController;
    private RAPLPowerStatus: boolean = false;
    private currentEnergy: number;
    private lastUpdateTime: number;

    constructor(intelRAPL: IntelRAPLController) {
        this.intelRAPL = intelRAPL;
        this.RAPLPowerStatus = this.intelRAPL.getIntelRAPLEnergyAvailable();
        this.currentEnergy = 0;
        this.lastUpdateTime = Date.now();
    }

    public getCurrentPower(): number {
        if (!this.RAPLPowerStatus) return -1;
        const currentEnergyUJ: number = this.intelRAPL.getEnergy();

        if (currentEnergyUJ === undefined || currentEnergyUJ < 0 || Number.isNaN(currentEnergyUJ)) {
            return -1;
        }

        if (this.currentEnergy === 0) {
            this.currentEnergy = currentEnergyUJ;
            this.lastUpdateTime = Date.now();
            return -1;
        }

        let energyIncrementUJ: number = currentEnergyUJ - this.currentEnergy;
        if (energyIncrementUJ < 0) {
            energyIncrementUJ += 4294967296;
        }

        const delay: number = this.getDelay();
        if (delay <= 0) {
            this.currentEnergy = currentEnergyUJ;
            return -1;
        }

        const powerDrawWatts: number = energyIncrementUJ / delay / 1000000;
        this.currentEnergy = currentEnergyUJ;

        if (powerDrawWatts < 0 || powerDrawWatts > 1000) {
            return -1;
        }

        return powerDrawWatts;
    }

    private getDelay(): number {
        const currentTime: number = Date.now();
        const timeDifference: number = this.lastUpdateTime > 0 ? (currentTime - this.lastUpdateTime) / 1000 : -1;
        this.lastUpdateTime = currentTime;
        return timeDifference;
    }
}

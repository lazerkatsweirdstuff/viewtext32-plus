// Extensions for Kitronik VIEWTEXT32 with custom character support

//% weight=100 color=#00A654 icon="\uf26c" block="ViewText32 Plus"
namespace viewtext32plus {
    let _I2CAddr: number;
    let _displayLength: number;
    let _displayMemory: Buffer;
    let _customChars: Buffer;

    // Initialize the display
    //% block="initialize VIEWTEXT32 at I2C address %i2caddr with %length characters"
    //% i2caddr.defl=98 length.defl=32
    //% i2caddr.min=0 i2caddr.max=255 length.min=1 length.max=32
    export function init(i2caddr: number, length: number): void {
        _I2CAddr = i2caddr;
        _displayLength = length;
        _displayMemory = pins.createBuffer(_displayLength + 1);
        _customChars = pins.createBuffer(64 * 8); // Space for 8 custom characters (8 bytes each)

        // Initialize display
        pins.i2cWriteBuffer(_I2CAddr, hex`00 38 0C 01 06`);
        basic.pause(50);
        clear();
    }

    // Clear the display
    //% block="clear display"
    export function clear(): void {
        _displayMemory.fill(0x20, 1); // Fill with spaces
        _displayMemory[0] = 0x00; // Command byte
        updateDisplay();
    }

    // Update the physical display
    function updateDisplay(): void {
        // Set DDRAM address to start of display
        pins.i2cWriteBuffer(_I2CAddr, hex`00 80`);
        // Write display memory (skip command byte)
        pins.i2cWriteBuffer(_I2CAddr, _displayMemory.slice(1));
    }

    // Show text at position
    //% block="show %text at position %position"
    //% position.min=0 position.max=31
    export function showText(text: string, position: number): void {
        if (position < 0 || position >= _displayLength) return;
        
        const endPos = Math.min(position + text.length, _displayLength);
        for (let i = position; i < endPos; i++) {
            _displayMemory[i + 1] = text.charCodeAt(i - position);
        }
        updateDisplay();
    }

    // CUSTOM CHARACTER FUNCTIONS

    //% block="create custom character %charCode with rows %row1|%row2|%row3|%row4|%row5|%row6|%row7|%row8"
    //% charCode.min=0 charCode.max=7
    //% row1.min=0 row1.max=31 row2.min=0 row2.max=31 row3.min=0 row3.max=31
    //% row4.min=0 row4.max=31 row5.min=0 row5.max=31 row6.min=0 row6.max=31
    //% row7.min=0 row7.max=31 row8.min=0 row8.max=31
    //% inlineInputMode=inline
    export function createCustomCharacter(charCode: number,
        row1: number, row2: number, row3: number, row4: number,
        row5: number, row6: number, row7: number, row8: number): void {

        // Only allow custom characters 0-7 (CGRAM locations)
        charCode = Math.min(7, Math.max(0, charCode));
        
        // Store the pattern in our buffer
        const offset = charCode * 8;
        _customChars[offset] = row1;
        _customChars[offset + 1] = row2;
        _customChars[offset + 2] = row3;
        _customChars[offset + 3] = row4;
        _customChars[offset + 4] = row5;
        _customChars[offset + 5] = row6;
        _customChars[offset + 6] = row7;
        _customChars[offset + 7] = row8;

        // Send to display
        sendCustomCharacter(charCode);
    }

    // Send a custom character definition to the display
    function sendCustomCharacter(charCode: number): void {
        const offset = charCode * 8;
        
        // Set CGRAM address (charCode * 8)
        pins.i2cWriteBuffer(_I2CAddr, hex`00 40` + (charCode << 3));
        
        // Send character data
        let charData = pins.createBuffer(9);
        charData[0] = 0x40; // Data write command
        for (let i = 0; i < 8; i++) {
            charData[i + 1] = _customChars[offset + i];
        }
        pins.i2cWriteBuffer(_I2CAddr, charData);
    }

    //% block="show custom character %charCode at position %position"
    //% charCode.min=0 charCode.max=7 position.min=0 position.max=31
    export function showCustomCharacter(charCode: number, position: number): void {
        if (position < 0 || position >= _displayLength) return;
        
        // Custom characters are displayed using codes 0-7
        _displayMemory[position + 1] = charCode;
        updateDisplay();
    }

    //% block="convert binary string %binary to custom character row"
    export function binaryToRow(binary: string): number {
        // Convert binary string to number (limited to 5 bits)
        let val = parseInt(binary, 2);
        return Math.min(31, Math.max(0, val));
    }

    //% block="design character %charCode with pixels || %pixels"
    //% charCode.min=0 charCode.max=7
    //% expandableArgumentMode="toggle"
    export function designCharacter(charCode: number, pixels?: number[][]): void {
        if (!pixels) {
            // If no pixels provided, create a blank character
            createCustomCharacter(charCode, 0, 0, 0, 0, 0, 0, 0, 0);
            return;
        }

        // Convert pixel array to row values
        let rows = [0, 0, 0, 0, 0, 0, 0, 0];
        
        for (let y = 0; y < Math.min(8, pixels.length); y++) {
            if (pixels[y]) {
                for (let x = 0; x < Math.min(5, pixels[y].length); x++) {
                    if (pixels[y][x]) {
                        rows[y] |= (1 << (4 - x));
                    }
                }
            }
        }
        
        createCustomCharacter(charCode, rows[0], rows[1], rows[2], rows[3],
            rows[4], rows[5], rows[6], rows[7]);
    }
}

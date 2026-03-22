/**
 * MidiInput — handles Web MIDI API connection to physical MIDI keyboards.
 * Auto-detects on launch, emits note-on/note-off events.
 */

export type MidiNoteCallback = (note: number, velocity: number) => void;

export interface MidiDeviceInfo {
  id: string;
  name: string;
  manufacturer: string;
}

class MidiInput {
  private access: MIDIAccess | null = null;
  private currentInput: MIDIInput | null = null;
  private onNoteOn: MidiNoteCallback | null = null;
  private onNoteOff: MidiNoteCallback | null = null;
  private onConnectionChange: ((connected: boolean, device?: MidiDeviceInfo) => void) | null = null;
  private _connected = false;
  private _deviceInfo: MidiDeviceInfo | null = null;

  async init(): Promise<boolean> {
    if (!navigator.requestMIDIAccess) {
      console.warn('Web MIDI API not available');
      return false;
    }

    try {
      this.access = await navigator.requestMIDIAccess({ sysex: false });

      // Listen for device connect/disconnect
      this.access.onstatechange = () => this.scanDevices();

      this.scanDevices();
      return true;
    } catch (err) {
      console.error('MIDI access denied:', err);
      return false;
    }
  }

  setCallbacks(opts: {
    onNoteOn?: MidiNoteCallback;
    onNoteOff?: MidiNoteCallback;
    onConnectionChange?: (connected: boolean, device?: MidiDeviceInfo) => void;
  }): void {
    if (opts.onNoteOn) this.onNoteOn = opts.onNoteOn;
    if (opts.onNoteOff) this.onNoteOff = opts.onNoteOff;
    if (opts.onConnectionChange) this.onConnectionChange = opts.onConnectionChange;
  }

  private scanDevices(): void {
    if (!this.access) return;

    const inputs = Array.from(this.access.inputs.values());

    if (inputs.length > 0) {
      const input = inputs[0]; // Use first available device
      if (this.currentInput?.id !== input.id) {
        // Disconnect old
        if (this.currentInput) {
          this.currentInput.onmidimessage = null;
        }

        this.currentInput = input;
        this.currentInput.onmidimessage = this.handleMidiMessage;

        this._connected = true;
        this._deviceInfo = {
          id: input.id,
          name: input.name ?? 'Unknown Keyboard',
          manufacturer: input.manufacturer ?? 'Unknown',
        };

        console.log(`MIDI connected: ${this._deviceInfo.name}`);
        this.onConnectionChange?.(true, this._deviceInfo);
      }
    } else {
      if (this._connected) {
        this._connected = false;
        this._deviceInfo = null;
        this.currentInput = null;
        console.log('MIDI disconnected');
        this.onConnectionChange?.(false);
      }
    }
  }

  private handleMidiMessage = (event: MIDIMessageEvent): void => {
    const [status, note, velocity] = event.data ?? [];
    if (status === undefined || note === undefined) return;

    const command = status & 0xf0;

    if (command === 0x90 && velocity > 0) {
      // Note On
      this.onNoteOn?.(note, velocity);
    } else if (command === 0x80 || (command === 0x90 && velocity === 0)) {
      // Note Off
      this.onNoteOff?.(note, 0);
    }
  };

  get connected(): boolean {
    return this._connected;
  }

  get deviceInfo(): MidiDeviceInfo | null {
    return this._deviceInfo;
  }

  getAvailableDevices(): MidiDeviceInfo[] {
    if (!this.access) return [];
    return Array.from(this.access.inputs.values()).map(input => ({
      id: input.id,
      name: input.name ?? 'Unknown',
      manufacturer: input.manufacturer ?? 'Unknown',
    }));
  }

  dispose(): void {
    if (this.currentInput) {
      this.currentInput.onmidimessage = null;
    }
    this.currentInput = null;
    this.access = null;
    this._connected = false;
  }
}

export const midiInput = new MidiInput();
export default midiInput;

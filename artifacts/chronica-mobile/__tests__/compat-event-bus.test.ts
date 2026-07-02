import { ChronicaEventBus } from '../engine/compat/event-bus';

describe('ChronicaEventBus', () => {
  test('dispatches to registered listeners in order', () => {
    const bus = new ChronicaEventBus();
    const seen: string[] = [];
    bus.on('choice-selected', payload => {
      seen.push(`a:${payload.choice.uid}`);
    });
    bus.on('choice-selected', payload => {
      seen.push(`b:${payload.choice.uid}`);
    });

    bus.emit('choice-selected', {
      choice: { uid: 'c1', label: '', action: '', conditions: [] },
    });

    expect(seen).toEqual(['a:c1', 'b:c1']);
  });

  test('unsubscribe stops further deliveries', () => {
    const bus = new ChronicaEventBus();
    const listener = jest.fn();
    const off = bus.on('session-reset', listener);
    off();
    bus.emit('session-reset', {});
    expect(listener).not.toHaveBeenCalled();
  });

  test('once fires exactly one time', () => {
    const bus = new ChronicaEventBus();
    const listener = jest.fn();
    bus.once('session-reset', listener);
    bus.emit('session-reset', {});
    bus.emit('session-reset', {});
    expect(listener).toHaveBeenCalledTimes(1);
  });

  test('unsubscribing during emit does not skip peers', () => {
    const bus = new ChronicaEventBus();
    const calls: string[] = [];
    const offA = bus.on('session-reset', () => {
      calls.push('a');
      offA();
    });
    bus.on('session-reset', () => calls.push('b'));

    bus.emit('session-reset', {});
    expect(calls).toEqual(['a', 'b']);
  });

  test('listener errors do not stop the loop and are forwarded', () => {
    const bus = new ChronicaEventBus();
    const errors: unknown[] = [];
    bus.onListenerError = (_event, err) => errors.push(err);

    bus.on('session-reset', () => { throw new Error('boom'); });
    const survivor = jest.fn();
    bus.on('session-reset', survivor);

    bus.emit('session-reset', {});
    expect(survivor).toHaveBeenCalledTimes(1);
    expect(errors).toHaveLength(1);
  });

  test('listenerCount tracks additions and removals', () => {
    const bus = new ChronicaEventBus();
    expect(bus.listenerCount('session-start')).toBe(0);
    const off = bus.on('session-start', () => {});
    expect(bus.listenerCount('session-start')).toBe(1);
    off();
    expect(bus.listenerCount('session-start')).toBe(0);
  });
});

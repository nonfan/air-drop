import { PeerJSTransport } from '../services/transport/PeerJSTransport';

describe('PeerJSTransport', () => {
  let transport: PeerJSTransport;

  beforeEach(() => {
    transport = new PeerJSTransport({
      host: 'localhost',
      port: 9000,
      path: '/peerjs',
      secure: false
    });
  });

  afterEach(() => {
    transport.disconnect();
  });

  it('should create transport instance', () => {
    expect(transport).toBeDefined();
  });

  it('should have getPeerId method', () => {
    expect(typeof transport.getPeerId).toBe('function');
  });

  it('should have connect method', () => {
    expect(typeof transport.connect).toBe('function');
  });

  it('should have connectToPeer method', () => {
    expect(typeof transport.connectToPeer).toBe('function');
  });

  it('should have send method', () => {
    expect(typeof transport.send).toBe('function');
  });

  it('should have sendFile method', () => {
    expect(typeof transport.sendFile).toBe('function');
  });

  it('should have disconnect method', () => {
    expect(typeof transport.disconnect).toBe('function');
  });
});

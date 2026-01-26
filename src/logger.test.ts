import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { Logger } from './logger.js';

describe('Logger', () => {
  let consoleSpy: ReturnType<typeof vi.spyOn>;
  let logger: Logger;

  beforeEach(() => {
    consoleSpy = vi.spyOn(console, 'log').mockImplementation(() => {});
    logger = new Logger(true);
  });

  afterEach(() => {
    consoleSpy.mockRestore();
  });

  describe('info', () => {
    it('should log info message', () => {
      logger.info('test message');
      
      expect(consoleSpy).toHaveBeenCalled();
      const call = consoleSpy.mock.calls[0];
      expect(call[1]).toBe('test message');
    });
  });

  describe('success', () => {
    it('should log success message', () => {
      logger.success('success message');
      
      expect(consoleSpy).toHaveBeenCalled();
      const call = consoleSpy.mock.calls[0];
      expect(call[1]).toBe('success message');
    });
  });

  describe('warn', () => {
    it('should log warning message', () => {
      logger.warn('warning message');
      
      expect(consoleSpy).toHaveBeenCalled();
      const call = consoleSpy.mock.calls[0];
      expect(call[1]).toBe('warning message');
    });
  });

  describe('error', () => {
    it('should log error message', () => {
      logger.error('error message');
      
      expect(consoleSpy).toHaveBeenCalled();
      const call = consoleSpy.mock.calls[0];
      expect(call[1]).toBe('error message');
    });
  });

  describe('step', () => {
    it('should log step with correct format', () => {
      logger.step(1, 5, 'Step message');
      
      expect(consoleSpy).toHaveBeenCalled();
      const call = consoleSpy.mock.calls[0];
      expect(call[1]).toBe('Step message');
    });
  });

  describe('detail', () => {
    it('should log detail when verbose is true', () => {
      const verboseLogger = new Logger(true);
      verboseLogger.detail('detail message');
      
      expect(consoleSpy).toHaveBeenCalled();
    });

    it('should not log detail when verbose is false', () => {
      const quietLogger = new Logger(false);
      quietLogger.detail('detail message');
      
      expect(consoleSpy).not.toHaveBeenCalled();
    });
  });

  describe('blank', () => {
    it('should log empty line', () => {
      logger.blank();
      
      expect(consoleSpy).toHaveBeenCalledWith();
    });
  });

  describe('header', () => {
    it('should log header with dividers', () => {
      logger.header('Header Title');
      
      // blank, top divider, title, bottom divider, blank = 5 calls
      expect(consoleSpy).toHaveBeenCalledTimes(5);
    });
  });

  describe('divider', () => {
    it('should log divider', () => {
      logger.divider();
      
      expect(consoleSpy).toHaveBeenCalled();
    });
  });

  describe('waiting', () => {
    it('should log waiting message', () => {
      logger.waiting('waiting message');
      
      expect(consoleSpy).toHaveBeenCalled();
      const call = consoleSpy.mock.calls[0];
      expect(call[1]).toBe('waiting message');
    });
  });

  describe('checkStatus', () => {
    it('should log success status', () => {
      logger.checkStatus('Test Check', 'completed', 'success');
      
      expect(consoleSpy).toHaveBeenCalled();
    });

    it('should log failure status', () => {
      logger.checkStatus('Test Check', 'completed', 'failure');
      
      expect(consoleSpy).toHaveBeenCalled();
    });

    it('should log pending status', () => {
      logger.checkStatus('Test Check', 'in_progress', null);
      
      expect(consoleSpy).toHaveBeenCalled();
    });
  });
});

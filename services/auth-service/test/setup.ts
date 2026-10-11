import { Logger } from '@nestjs/common';

// Keep test output readable; behavior is asserted, not logged.
Logger.overrideLogger(false);

import '@testing-library/jest-dom';
import { beforeEach } from 'vitest';
import { DESKTOP_WIDTH, installMatchMedia, setViewportWidth } from './viewport';

installMatchMedia();

// Desktop unless a test says otherwise, so existing suites keep asserting the
// desktop layout without opting in.
beforeEach(() => setViewportWidth(DESKTOP_WIDTH));

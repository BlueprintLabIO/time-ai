#!/usr/bin/env node

/**
 * Continuous test monitoring script
 * This script runs tests continuously and alerts on failures
 */

const { spawn } = require('child_process');
const fs = require('fs');
const path = require('path');

class TestMonitor {
  constructor() {
    this.isRunning = false;
    this.lastResults = null;
    this.failureCount = 0;
    this.alertThreshold = 3; // Alert after 3 consecutive failures
    this.testInterval = 30000; // Run tests every 30 seconds
    this.watchMode = false;
  }

  log(message, type = 'info') {
    const timestamp = new Date().toISOString();
    const colors = {
      info: '\x1b[36m',    // cyan
      success: '\x1b[32m', // green
      warning: '\x1b[33m', // yellow
      error: '\x1b[31m',   // red
      reset: '\x1b[0m'     // reset
    };

    console.log(`${colors[type]}[${timestamp}] ${message}${colors.reset}`);
  }

  async runTests() {
    if (this.isRunning) {
      this.log('Tests already running, skipping...', 'warning');
      return;
    }

    this.isRunning = true;
    this.log('Starting test run...', 'info');

    return new Promise((resolve) => {
      const jest = spawn('npm', ['test'], {
        stdio: 'pipe',
        cwd: process.cwd()
      });

      let stdout = '';
      let stderr = '';

      jest.stdout.on('data', (data) => {
        stdout += data.toString();
      });

      jest.stderr.on('data', (data) => {
        stderr += data.toString();
      });

      jest.on('close', (code) => {
        this.isRunning = false;
        const results = {
          success: code === 0,
          code,
          stdout,
          stderr,
          timestamp: new Date().toISOString()
        };

        this.processResults(results);
        resolve(results);
      });

      jest.on('error', (error) => {
        this.isRunning = false;
        this.log(`Test execution error: ${error.message}`, 'error');
        resolve({
          success: false,
          error: error.message,
          timestamp: new Date().toISOString()
        });
      });
    });
  }

  processResults(results) {
    this.lastResults = results;

    if (results.success) {
      this.failureCount = 0;
      this.log('✅ All tests passed!', 'success');
      this.extractTestStats(results.stdout);
    } else {
      this.failureCount++;
      this.log(`❌ Tests failed (attempt ${this.failureCount})`, 'error');
      this.handleFailure(results);
    }

    this.saveResults(results);
  }

  extractTestStats(stdout) {
    try {
      // Extract Jest test summary
      const lines = stdout.split('\n');
      const summaryLine = lines.find(line => line.includes('Tests:') && line.includes('passed'));

      if (summaryLine) {
        this.log(`📊 ${summaryLine.trim()}`, 'info');
      }

      // Extract coverage information if available
      const coverageLine = lines.find(line => line.includes('Coverage:') || line.includes('All files'));
      if (coverageLine) {
        this.log(`📈 ${coverageLine.trim()}`, 'info');
      }

      // Extract execution time
      const timeLine = lines.find(line => line.includes('Time:'));
      if (timeLine) {
        this.log(`⏱️  ${timeLine.trim()}`, 'info');
      }
    } catch (error) {
      this.log(`Error extracting test stats: ${error.message}`, 'warning');
    }
  }

  handleFailure(results) {
    try {
      // Extract failed test information
      const lines = results.stdout.split('\n');
      const failureStart = lines.findIndex(line => line.includes('FAIL'));

      if (failureStart !== -1) {
        const failureLines = lines.slice(failureStart, failureStart + 10);
        this.log('Failed tests:', 'error');
        failureLines.forEach(line => {
          if (line.trim()) {
            this.log(`  ${line}`, 'error');
          }
        });
      }

      // Alert if failure threshold reached
      if (this.failureCount >= this.alertThreshold) {
        this.alertOnFailure(results);
      }
    } catch (error) {
      this.log(`Error processing failure: ${error.message}`, 'warning');
    }
  }

  alertOnFailure(results) {
    this.log(`🚨 ALERT: ${this.failureCount} consecutive test failures!`, 'error');

    // Create failure report
    const report = {
      timestamp: results.timestamp,
      failureCount: this.failureCount,
      lastError: results.stderr,
      recommendation: 'Please review the failing tests and fix issues immediately.'
    };

    // Save failure report
    const reportPath = path.join(process.cwd(), 'test-failure-report.json');
    fs.writeFileSync(reportPath, JSON.stringify(report, null, 2));
    this.log(`📄 Failure report saved to: ${reportPath}`, 'warning');

    // In a real environment, you could send notifications here:
    // - Send email
    // - Post to Slack
    // - Create GitHub issue
    // - Send SMS alert
  }

  saveResults(results) {
    const resultsDir = path.join(process.cwd(), 'test-results');

    if (!fs.existsSync(resultsDir)) {
      fs.mkdirSync(resultsDir, { recursive: true });
    }

    const filename = `test-results-${new Date().toISOString().replace(/[:.]/g, '-')}.json`;
    const filepath = path.join(resultsDir, filename);

    fs.writeFileSync(filepath, JSON.stringify(results, null, 2));

    // Keep only last 50 results
    const files = fs.readdirSync(resultsDir)
      .filter(file => file.startsWith('test-results-'))
      .sort()
      .reverse();

    if (files.length > 50) {
      files.slice(50).forEach(file => {
        fs.unlinkSync(path.join(resultsDir, file));
      });
    }
  }

  async runCoverage() {
    this.log('Running test coverage analysis...', 'info');

    return new Promise((resolve) => {
      const jest = spawn('npm', ['run', 'test', '--', '--coverage'], {
        stdio: 'pipe',
        cwd: process.cwd()
      });

      let stdout = '';
      let stderr = '';

      jest.stdout.on('data', (data) => {
        stdout += data.toString();
      });

      jest.stderr.on('data', (data) => {
        stderr += data.toString();
      });

      jest.on('close', (code) => {
        if (code === 0) {
          this.log('📊 Coverage report generated', 'success');
          // Extract coverage percentages
          this.extractCoverageStats(stdout);
        } else {
          this.log('❌ Coverage analysis failed', 'error');
        }
        resolve(code === 0);
      });
    });
  }

  extractCoverageStats(stdout) {
    try {
      const lines = stdout.split('\n');
      const coverageSection = [];
      let inCoverageSection = false;

      for (const line of lines) {
        if (line.includes('Coverage summary')) {
          inCoverageSection = true;
          continue;
        }
        if (inCoverageSection) {
          if (line.includes('% Lines') || line.includes('% Functions') ||
              line.includes('% Branches') || line.includes('% Statements')) {
            coverageSection.push(line.trim());
          }
          if (line.trim() === '' && coverageSection.length > 0) {
            break;
          }
        }
      }

      if (coverageSection.length > 0) {
        this.log('Coverage Summary:', 'info');
        coverageSection.forEach(line => {
          const percentage = line.match(/(\d+(?:\.\d+)?)%/);
          const type = percentage ? (parseFloat(percentage[1]) >= 80 ? 'success' : 'warning') : 'info';
          this.log(`  ${line}`, type);
        });
      }
    } catch (error) {
      this.log(`Error extracting coverage stats: ${error.message}`, 'warning');
    }
  }

  async startContinuousMonitoring() {
    this.log('🚀 Starting continuous test monitoring...', 'info');
    this.log(`📝 Running tests every ${this.testInterval / 1000} seconds`, 'info');
    this.log(`⚠️  Will alert after ${this.alertThreshold} consecutive failures`, 'warning');

    // Run initial test
    await this.runTests();

    // Run coverage analysis once
    await this.runCoverage();

    // Set up continuous monitoring
    const interval = setInterval(async () => {
      await this.runTests();
    }, this.testInterval);

    // Handle graceful shutdown
    process.on('SIGINT', () => {
      this.log('🛑 Stopping test monitoring...', 'warning');
      clearInterval(interval);
      process.exit(0);
    });

    process.on('SIGTERM', () => {
      this.log('🛑 Stopping test monitoring...', 'warning');
      clearInterval(interval);
      process.exit(0);
    });
  }

  async runOnce() {
    this.log('🧪 Running test suite once...', 'info');
    const results = await this.runTests();
    await this.runCoverage();
    return results;
  }
}

// CLI interface
const command = process.argv[2];
const monitor = new TestMonitor();

switch (command) {
  case 'continuous':
  case 'watch':
    monitor.startContinuousMonitoring();
    break;
  case 'once':
  case 'run':
  default:
    monitor.runOnce().then(() => {
      process.exit(monitor.lastResults?.success ? 0 : 1);
    });
    break;
}
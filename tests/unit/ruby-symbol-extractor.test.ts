import { describe, expect, it } from 'vitest';
import { extractRubySymbols } from '../../src/scanner/ruby-symbol-extractor.js';

describe('ruby symbol extractor', () => {
  it('extracts requires, modules, classes, and methods', async () => {
    const result = await extractRubySymbols(
      `require "json"
require_relative "../lib/support"

module Admin
  class UserController
    def index
    end

    def self.policy
    end
  end
end

def boot
end
`,
      'app/controllers/user_controller.rb',
    );

    expect(result.dependencies).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ specifier: 'json', kind: 'package' }),
        expect.objectContaining({
          specifier: '../lib/support',
          kind: 'local',
        }),
      ]),
    );
    expect(result.symbols).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ name: 'Admin', kind: 'type' }),
        expect.objectContaining({
          name: 'UserController',
          kind: 'class',
          parentName: 'Admin',
        }),
        expect.objectContaining({
          name: 'index',
          kind: 'method',
          parentName: 'UserController',
        }),
        expect.objectContaining({
          name: 'policy',
          kind: 'method',
          parentName: 'UserController',
        }),
        expect.objectContaining({ name: 'boot', kind: 'function' }),
      ]),
    );
  });
});

import type { ComponentType } from 'react';
import { SUB_TYPE } from '../../constants/chat.ts';

const messageCardModules = import.meta.glob<{
  default: ComponentType<{ content: unknown }>;
  messageType?: (typeof SUB_TYPE)[keyof typeof SUB_TYPE];
}>('./*.jsx', { eager: true });

export const messageComponentMap = Object.fromEntries(
  Object.values(messageCardModules)
    .filter((module) => Number.isInteger(module.messageType))
    .map((module) => [module.messageType, module.default]),
) as Record<(typeof SUB_TYPE)[keyof typeof SUB_TYPE], ComponentType<{ content: unknown }>>;

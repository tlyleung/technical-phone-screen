'use client';

import { Button } from '@/components/catalyst/button';
import {
  Description,
  ErrorMessage,
  Field,
  FieldGroup,
  Fieldset,
  Label,
} from '@/components/catalyst/fieldset';
import { Heading } from '@/components/catalyst/heading';
import { Input } from '@/components/catalyst/input';
import {
  Navbar,
  NavbarItem,
  NavbarSection,
  NavbarSpacer,
} from '@/components/catalyst/navbar';
import { Select } from '@/components/catalyst/select';
import {
  Sidebar,
  SidebarBody,
  SidebarDivider,
  SidebarFooter,
  SidebarHeader,
  SidebarHeading,
  SidebarItem,
  SidebarLabel,
  SidebarSection,
  SidebarSpacer,
} from '@/components/catalyst/sidebar';
import { SidebarLayout } from '@/components/catalyst/sidebar-layout';
import { Text } from '@/components/catalyst/text';
import { Textarea } from '@/components/catalyst/textarea';
import { ActaMachinaIcon, GitHubIcon } from '@/components/icons';
import { WavRecorder, WavStreamPlayer } from '@/lib/wavtools/index.js';
import { getInstructions } from '@/utils/conversation_config';
import { PhoneIcon } from '@heroicons/react/16/solid';
import { ArrowUturnLeftIcon } from '@heroicons/react/20/solid';
import { RealtimeClient } from '@openai/realtime-api-beta';
import { useEffect, useRef, useState } from 'react';
import { useDebounce } from 'use-debounce';

const DEBOUNCE_TIME = 1000;

/**
 * Elapsed time custom hook
 */
const useElapsedTime = (isConnected: boolean) => {
  const [elapsedTime, setElapsedTime] = useState(0);
  const startTimeRef = useRef<number | null>(null);

  useEffect(() => {
    let animationFrame: number = 0;

    const updateElapsedTime = () => {
      if (isConnected && startTimeRef.current) {
        const now = new Date().getTime();
        const difference = Math.floor((now - startTimeRef.current) / 1000);
        setElapsedTime(difference);
        animationFrame = requestAnimationFrame(updateElapsedTime);
      }
    };

    if (isConnected) {
      startTimeRef.current = new Date().getTime();
      updateElapsedTime();
    } else {
      cancelAnimationFrame(animationFrame);
    }

    return () => cancelAnimationFrame(animationFrame);
  }, [isConnected]);

  return elapsedTime;
};

export default function Page() {
  const [code, setCode] = useState('');
  const [debouncedCode] = useDebounce(code, DEBOUNCE_TIME);
  const [isConnected, setIsConnected] = useState(false);
  const clientRef = useRef<RealtimeClient | null>(null);
  const elapsedTime = useElapsedTime(isConnected);

  // Settings
  const [openAIApiKey, setOpenAIApiKey] = useState('');
  const [openAIApiKeyError, setOpenAIApiKeyError] = useState(false);
  const [candidateName, setCandidateName] = useState('Sam');
  const [difficulty, setDifficulty] = useState('medium');

  const wavRecorderRef = useRef<WavRecorder>(
    new WavRecorder({ sampleRate: 24000 }),
  );
  const wavStreamPlayerRef = useRef<WavStreamPlayer>(
    new WavStreamPlayer({ sampleRate: 24000 }),
  );

  /**
   * Send `debouncedCode` to the Realtime API when it changes
   */
  useEffect(() => {
    const client = clientRef.current;
    if (debouncedCode && client && isConnected) {
      console.log('Sending code:', '```\n' + debouncedCode + '\n```');
      client.sendUserMessageContent([
        { type: 'input_text', text: '```\n' + debouncedCode + '\n```' },
      ]);
    }
  }, [debouncedCode, isConnected]);

  /**
   * Core RealtimeClient and audio capture setup
   */
  useEffect(() => {
    const client = new RealtimeClient({
      apiKey: openAIApiKey,
      dangerouslyAllowAPIKeyInBrowser: true,
    });

    const wavStreamPlayer = wavStreamPlayerRef.current;

    // @ts-ignore
    client.on('error', (event) => {
      console.error('Error:', event);
    });

    client.on('conversation.interrupted', async () => {
      console.log('Conversation interrupted');
      const trackSampleOffset = await wavStreamPlayer.interrupt();
      if (trackSampleOffset?.trackId) {
        const { trackId, offset } = trackSampleOffset;
        await client.cancelResponse(trackId, offset);
      }
    });

    // @ts-ignore
    client.on('conversation.updated', async ({ item, delta }) => {
      if (delta?.audio) {
        wavStreamPlayer.add16BitPCM(delta.audio, item.id);
      }
      if (item.status === 'completed' && item.formatted.audio?.length) {
        const wavFile = await WavRecorder.decode(
          item.formatted.audio,
          24000,
          24000,
        );
        item.formatted.file = wavFile;
      }
      if (
        item.status === 'completed' &&
        item.formatted.transcript?.length > 1
      ) {
        const role = item.role[0].toUpperCase() + item.role.slice(1);
        console.log(`${role}: ${item.formatted.transcript}`);
      }
    });

    clientRef.current = client;

    return () => {
      clientRef.current?.disconnect();
    };
  }, [openAIApiKey]);

  /**
   * Connect to conversation and start recording audio
   */
  const connect = async () => {
    if (!openAIApiKey) {
      setOpenAIApiKeyError(true);
      return;
    }

    console.log('Connecting...');
    setIsConnected(true);

    if (!clientRef.current) return;

    const client = clientRef.current;
    const wavRecorder = wavRecorderRef.current;
    const wavStreamPlayer = wavStreamPlayerRef.current;

    // Set parameters ahead of connecting
    client.updateSession({
      input_audio_transcription: { model: 'whisper-1' },
      instructions: getInstructions(candidateName, difficulty, 'Julia'),
      turn_detection: { type: 'server_vad' },
      voice: 'alloy',
    });

    await wavRecorder.begin();
    await wavStreamPlayer.connect();
    await client.connect();
    await client.waitForSessionCreated();
    await wavRecorder.record((data) => client.appendInputAudio(data.mono));

    // Start interview
    client.createResponse();
  };

  /**
   * Disconnect from conversation and stop recording audio
   */
  const disconnect = async () => {
    console.log('Disconnecting...');
    setIsConnected(false);

    if (!clientRef.current) return;

    const client = clientRef.current;
    const wavRecorder = wavRecorderRef.current;
    const wavStreamPlayer = wavStreamPlayerRef.current;

    client.disconnect();
    await wavRecorder.end();
    await wavStreamPlayer.interrupt();
  };

  /**
   * Utility for formatting the elapsed time
   */
  const formatTime = (elapsedSeconds: number) => {
    const minutes = Math.floor(elapsedSeconds / 60);
    const seconds = elapsedSeconds % 60;
    return `${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`;
  };

  /**
   * Handle tab key press to insert 4 spaces
   */
  const handleKeyDown = async (
    event: React.KeyboardEvent<HTMLTextAreaElement>,
  ) => {
    if (event.key === 'Tab') {
      event.preventDefault();
      const target = event.target as HTMLTextAreaElement;
      const { selectionStart, selectionEnd } = target;

      // Insert 4 spaces at the caret position
      const updatedCode =
        code.substring(0, selectionStart) +
        '    ' +
        code.substring(selectionEnd);
      setCode(updatedCode);

      // Move caret to after the inserted spaces
      setTimeout(() => {
        target.selectionStart = target.selectionEnd = selectionStart + 4;
      }, 0);
    }
  };

  /**
   * Handle key press to interrupt conversation
   */
  const handleKeyUp = async () => {
    if (!clientRef.current) return;

    const client = clientRef.current;
    const wavStreamPlayer = wavStreamPlayerRef.current;

    const trackSampleOffset = await wavStreamPlayer.interrupt();
    if (trackSampleOffset?.trackId) {
      const { trackId, offset } = trackSampleOffset;
      await client.cancelResponse(trackId, offset);
    }
  };

  return (
    <SidebarLayout
      navbar={
        <Navbar>
          <NavbarSpacer />
          <NavbarSection>
            <NavbarItem href="/demos" aria-label="Back to Demos">
              <ArrowUturnLeftIcon />
            </NavbarItem>
            <NavbarItem
              href="https://github.com/tlyleung/technical-phone-screen"
              aria-label="GitHub Repository"
            >
              <GitHubIcon />
            </NavbarItem>
          </NavbarSection>
        </Navbar>
      }
      sidebar={
        <Sidebar>
          <SidebarHeader>
            <SidebarSection>
              <SidebarItem href="/" aria-label="Acta Machina">
                <span className="inline-grid size-8 shrink-0 rounded-full bg-zinc-900 p-1.5 align-middle text-white outline outline-1 -outline-offset-1 outline-black/[--ring-opacity] [--avatar-radius:20%] [--ring-opacity:20%] *:col-start-1 *:row-start-1 *:rounded-full dark:bg-white dark:text-black dark:outline-white/[--ring-opacity]">
                  <ActaMachinaIcon />
                </span>
                <SidebarLabel>Acta Machina</SidebarLabel>
              </SidebarItem>
            </SidebarSection>
          </SidebarHeader>
          <SidebarBody>
            <SidebarSection>
              <SidebarHeading>Instructions</SidebarHeading>
              <Text className="px-2">
                You are a candidate for a technical phone screen with access to
                a code editor.
              </Text>
            </SidebarSection>
            <SidebarDivider />
            <SidebarSection>
              <SidebarHeading>Settings</SidebarHeading>
              <Fieldset className="px-2">
                <FieldGroup>
                  <Field>
                    <Label>OpenAI API Key</Label>
                    <Input
                      name="openai_api_key"
                      value={openAIApiKey}
                      invalid={openAIApiKeyError}
                      onChange={(e) => setOpenAIApiKey(e.target.value)}
                      onFocus={() => setOpenAIApiKeyError(false)}
                    />
                    {openAIApiKeyError && (
                      <ErrorMessage>Invalid OpenAI API Key</ErrorMessage>
                    )}
                    {!openAIApiKeyError && (
                      <Description>
                        Realtime API costs are approximately 24¢ per minute.
                      </Description>
                    )}
                  </Field>
                  <Field>
                    <Label>Name</Label>
                    <Input
                      name="candidate_name"
                      value={candidateName}
                      onChange={(e) => setCandidateName(e.target.value)}
                    />
                  </Field>
                  <Field>
                    <Label>Difficulty</Label>
                    <Select
                      name="difficulty"
                      value={difficulty}
                      onChange={(e) => setDifficulty(e.target.value)}
                    >
                      <option value="easy">Easy</option>
                      <option value="medium">Medium</option>
                      <option value="hard">Hard</option>
                    </Select>
                  </Field>
                </FieldGroup>
              </Fieldset>
            </SidebarSection>
            <SidebarSpacer />
          </SidebarBody>
          <SidebarFooter>
            <SidebarSection>
              <SidebarItem href="/demos" aria-label="Back to Demos">
                <ArrowUturnLeftIcon />
                <SidebarLabel>Back to Demos</SidebarLabel>
              </SidebarItem>
              <SidebarItem
                href="https://github.com/tlyleung/technical-phone-screen"
                aria-label="GitHub Repository"
              >
                <GitHubIcon />
                <SidebarLabel>GitHub Repository</SidebarLabel>
              </SidebarItem>
            </SidebarSection>
          </SidebarFooter>
        </Sidebar>
      }
    >
      <div className="flex items-end justify-between gap-4">
        <Heading>Technical Phone Screen</Heading>
        <Button
          color={isConnected ? 'red' : 'green'}
          className="-my-0.5 tabular-nums"
          onClick={isConnected ? disconnect : connect}
        >
          <PhoneIcon />
          {isConnected ? formatTime(elapsedTime) : 'Start'}
        </Button>
      </div>
      <div>
        <Textarea
          className="mt-8 font-mono"
          rows={16}
          value={code}
          onChange={(e) => setCode(e.target.value)}
          onKeyDown={handleKeyDown}
          onKeyUp={handleKeyUp}
        />
      </div>
    </SidebarLayout>
  );
}

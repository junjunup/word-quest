#import <AVFoundation/AVFoundation.h>
#import <Foundation/Foundation.h>
#import <Speech/Speech.h>

static SFSpeechRecognizer *WQRecognizer;
static SFSpeechAudioBufferRecognitionRequest *WQRequest;
static SFSpeechRecognitionTask *WQTask;
static AVAudioEngine *WQAudioEngine;
static NSString *WQText = @"";
static float WQConfidence = 0.0f;
static int WQState = 0;
static NSInteger WQGeneration = 0;
static BOOL WQShouldStart = NO;

static void WQSetError(NSString *message)
{
    WQText = message.length > 0 ? message : @"语音识别失败";
    WQConfidence = 0.0f;
    WQState = 3;
}

static void WQStopAudio()
{
    if (WQAudioEngine != nil) {
        if (WQAudioEngine.isRunning) {
            [WQAudioEngine stop];
        }
        @try {
            [WQAudioEngine.inputNode removeTapOnBus:0];
        } @catch (NSException *exception) {
            // Removing an absent tap is harmless during teardown.
        }
    }
    [WQRequest endAudio];
}

static BOOL WQStartAuthorized(
    NSString *localeIdentifier,
    NSInteger generation)
{
    if (!WQShouldStart || generation != WQGeneration) {
        return NO;
    }
    WQRecognizer = [[SFSpeechRecognizer alloc]
        initWithLocale:[NSLocale localeWithLocaleIdentifier:localeIdentifier]];
    if (WQRecognizer == nil || !WQRecognizer.available) {
        WQSetError(@"macOS Speech 服务当前不可用");
        return NO;
    }

    WQRequest = [[SFSpeechAudioBufferRecognitionRequest alloc] init];
    WQRequest.shouldReportPartialResults = YES;
    WQRequest.taskHint = SFSpeechRecognitionTaskHintConfirmation;
    if (@available(macOS 10.15, *)) {
        WQRequest.requiresOnDeviceRecognition =
            WQRecognizer.supportsOnDeviceRecognition;
    }

    WQAudioEngine = [[AVAudioEngine alloc] init];
    AVAudioInputNode *input = WQAudioEngine.inputNode;
    AVAudioFormat *format = [input outputFormatForBus:0];
    if (format.channelCount == 0) {
        WQSetError(@"未检测到可用麦克风输入");
        return NO;
    }

    [input installTapOnBus:0
                bufferSize:1024
                    format:format
                     block:^(AVAudioPCMBuffer *buffer, AVAudioTime *when) {
        [WQRequest appendAudioPCMBuffer:buffer];
    }];

    WQTask = [WQRecognizer
        recognitionTaskWithRequest:WQRequest
        resultHandler:^(SFSpeechRecognitionResult *result, NSError *error) {
            dispatch_async(dispatch_get_main_queue(), ^{
                if (generation != WQGeneration) {
                    return;
                }
                if (result != nil) {
                    WQText =
                        result.bestTranscription.formattedString ?: @"";
                    NSArray<SFTranscriptionSegment *> *segments =
                        result.bestTranscription.segments;
                    float total = 0.0f;
                    for (SFTranscriptionSegment *segment in segments) {
                        total += segment.confidence;
                    }
                    WQConfidence = segments.count > 0
                        ? total / (float)segments.count
                        : 0.0f;
                    if (result.isFinal) {
                        WQStopAudio();
                        WQState = WQText.length > 0 ? 2 : 3;
                    }
                }
                if (error != nil && WQState != 2) {
                    WQStopAudio();
                    WQSetError(error.localizedDescription);
                }
            });
        }];

    NSError *audioError = nil;
    [WQAudioEngine prepare];
    if (![WQAudioEngine startAndReturnError:&audioError]) {
        WQStopAudio();
        WQSetError(audioError.localizedDescription);
        return NO;
    }

    WQState = 1;
    return YES;
}

extern "C" int WordQuestSpeechIsAvailable()
{
    SFSpeechRecognizerAuthorizationStatus status =
        [SFSpeechRecognizer authorizationStatus];
    return status != SFSpeechRecognizerAuthorizationStatusDenied &&
           status != SFSpeechRecognizerAuthorizationStatusRestricted;
}

extern "C" int WordQuestSpeechStart(const char *locale)
{
    if (!WordQuestSpeechIsAvailable()) {
        WQSetError(@"语音识别权限未授权");
        return 0;
    }

    WQText = @"";
    WQConfidence = 0.0f;
    WQState = 1;
    WQShouldStart = YES;
    WQGeneration++;
    NSInteger generation = WQGeneration;
    NSString *identifier = locale == nullptr
        ? @"en-US"
        : [NSString stringWithUTF8String:locale];

    SFSpeechRecognizerAuthorizationStatus status =
        [SFSpeechRecognizer authorizationStatus];
    if (status == SFSpeechRecognizerAuthorizationStatusAuthorized) {
        dispatch_async(dispatch_get_main_queue(), ^{
            WQStartAuthorized(identifier, generation);
        });
        return 1;
    }

    [SFSpeechRecognizer
        requestAuthorization:^(SFSpeechRecognizerAuthorizationStatus result) {
            dispatch_async(dispatch_get_main_queue(), ^{
                if (result ==
                    SFSpeechRecognizerAuthorizationStatusAuthorized) {
                    WQStartAuthorized(identifier, generation);
                } else {
                    WQSetError(@"语音识别权限未授权");
                }
            });
        }];
    return 1;
}

extern "C" void WordQuestSpeechStop()
{
    WQShouldStart = NO;
    NSInteger generation = WQGeneration;
    dispatch_async(dispatch_get_main_queue(), ^{
        if (generation != WQGeneration) {
            return;
        }
        WQStopAudio();
        [WQTask finish];
        dispatch_after(
            dispatch_time(DISPATCH_TIME_NOW, (int64_t)(1.0 * NSEC_PER_SEC)),
            dispatch_get_main_queue(),
            ^{
                if (generation == WQGeneration && WQState == 1) {
                    if (WQText.length > 0) {
                        WQState = 2;
                    } else {
                        WQSetError(@"没有识别到有效语音");
                    }
                }
            });
    });
}

extern "C" int WordQuestSpeechState()
{
    return WQState;
}

extern "C" const char *WordQuestSpeechTranscript()
{
    return [WQText UTF8String];
}

extern "C" float WordQuestSpeechConfidence()
{
    return WQConfidence;
}

extern "C" void WordQuestSpeechReset()
{
    WQShouldStart = NO;
    WQGeneration++;
    NSInteger generation = WQGeneration;
    dispatch_async(dispatch_get_main_queue(), ^{
        if (generation != WQGeneration) {
            return;
        }
        WQStopAudio();
        [WQTask cancel];
        WQTask = nil;
        WQRequest = nil;
        WQRecognizer = nil;
        WQAudioEngine = nil;
        WQText = @"";
        WQConfidence = 0.0f;
        WQState = 0;
    });
}

//
// Copyright (c) Microsoft. All rights reserved.
// Licensed under the MIT license. See LICENSE.md file in the project root for full license information.
//

using System;
using System.Threading;
using System.Threading.Tasks;
using Carbon;

namespace Carbon.Recognition.Intent
{
    /// <summary>
    /// Defines the intent recognizer class containing both methods and events for intent recognition.
    /// </summary>
    public sealed class IntentRecognizer : Recognition.Recognizer
    {
        /// <summary>
        /// Defines event handler for the intermediate recognition result event.
        /// </summary>
        public event EventHandler<IntentRecognitionResultEventArgs> OnIntermediateResult;

        /// <summary>
        /// Defines event handler for the final recognition result event.
        /// </summary>
        public event EventHandler<IntentRecognitionResultEventArgs> OnFinalResult;

        /// <summary>
        /// Defines event handler for the recognition error event.
        /// </summary>
        public event EventHandler<RecognitionErrorEventArgs> OnRecognitionError;

        internal IntentRecognizer(Internal.IntentRecognizer recoImpl)
        {
            this.recoImpl = recoImpl;

            intermediateResultHandler = new IntentHandlerImpl(this, isFinalResultHandler: false);
            recoImpl.IntermediateResult.Connect(intermediateResultHandler);

            finalResultHandler = new IntentHandlerImpl(this, isFinalResultHandler: true);
            recoImpl.FinalResult.Connect(finalResultHandler);

            errorHandler = new ErrorHandlerImpl(this);
            recoImpl.NoMatch.Connect(errorHandler);
            recoImpl.Canceled.Connect(errorHandler);

            recoImpl.SessionStarted.Connect(sessionStartedHandler);
            recoImpl.SessionStopped.Connect(sessionStoppedHandler);
            recoImpl.SoundStarted.Connect(soundStartedHandler);
            recoImpl.SoundStopped.Connect(soundStoppedHandler);
        }

        /// <summary>
        /// Sets/Gets the spoken language of audio.
        /// </summary>
        public string Language
        {
            get
            {
                return Parameters.Get<string>(ParameterNames.SpeechRecognitionLanguage);
            }

            set
            {
                Parameters.Set(ParameterNames.SpeechRecognitionLanguage, value);
            }
        }

        /// <summary>
        /// Starts intent recognition
        /// </summary>
        /// <returns>A task representing the recognition operation.</returns>
        public Task<IntentRecognitionResult> RecognizeAsync()
        {
            return Task.Run(() => { return new IntentRecognitionResult(this.recoImpl.Recognize()); });
        }

        /// <summary>
        /// Starts continuous intent recognition, until user calls StopContinuousRecognitionAsync(). User must subscribe to 
        /// result events to receive recognition results.
        /// </summary>
        /// <returns>A task representing the asynchronous operation that starts the recognition.</returns>
        public Task StartContinuousRecognitionAsync()
        {
            return Task.Run(() => { this.recoImpl.StartContinuousRecognition(); });
        }

        /// <summary>
        /// Stops continuous intent recognition.
        /// </summary>
        /// <returns>A task representing the asynchronous operation that stops the recognition.</returns>
        public Task StopContinuousRecognitionAsync()
        {
            return Task.Run(() => { this.recoImpl.StopContinuousRecognition(); });
        }

        /// <summary>
        /// Adds an intent to be recognized.
        /// </summary>
        /// <param name="intentId">A string that represents the identifier of the intent to be added.</param>
        /// <param name="phrase">A string that specifies the phrase representing the intent.</param>
        public void AddIntent(string intentId, string phrase)
        {
            recoImpl.AddIntent(intentId, phrase);
        }

        /// <summary>
        /// Adds an intent to be recognized.
        /// </summary>
        /// <param name="intentId">A string that represents the identifier of the intent to be added.</param>
        /// <param name="model">The LUIS model used for intent recognition.</param>
        /// <param name="intentName">The name of intent that should be recognized. If it is null, all intent names defined in the LUIS model will be recognized.</param>
        public void AddIntent(string intentId, LuisModel model, string intentName = null)
        {
            var trigger = Carbon.Internal.IntentTrigger.From(model.modelImpl, intentName);
            recoImpl.AddIntent(intentId, trigger);
        }

        /// <summary>
        /// Represents the collection of parameters and their values defined for this <see cref="IntentRecognizer"/>.
        /// </summary>
        public ParameterCollection<IntentRecognizer> Parameters { get; }

        protected override void Dispose(bool disposing)
        {
            if (disposed)
            {
                return;
            }

            if (disposing)
            {
                recoImpl.IntermediateResult.Disconnect(intermediateResultHandler);
                recoImpl.FinalResult.Disconnect(finalResultHandler);
                recoImpl.NoMatch.Disconnect(errorHandler);
                recoImpl.Canceled.Disconnect(errorHandler);
                recoImpl.SessionStarted.Disconnect(sessionStartedHandler);
                recoImpl.SessionStopped.Disconnect(sessionStoppedHandler);
                recoImpl.SoundStarted.Disconnect(soundStartedHandler);
                recoImpl.SoundStopped.Disconnect(soundStoppedHandler);

                intermediateResultHandler.Dispose();
                finalResultHandler.Dispose();
                errorHandler.Dispose();
                recoImpl.Dispose();
                Parameters.Dispose();
                disposed = true;
                base.Dispose(disposing);
            }
        }

        private bool disposed = false;
        private Internal.IntentRecognizer recoImpl;
        private IntentHandlerImpl intermediateResultHandler;
        private IntentHandlerImpl finalResultHandler;
        private ErrorHandlerImpl errorHandler;

        /// <summary>
        /// Defines an internal class to raise a C# event for intermediate/final result when a corresponding callback is invoked by the native layer.
        /// </summary>
        private class IntentHandlerImpl : Internal.IntentEventListener
        {
            public IntentHandlerImpl(IntentRecognizer recognizer, bool isFinalResultHandler)
            {
                this.recognizer = recognizer;
                this.isFinalResultHandler = isFinalResultHandler;
            }

            public override void Execute(Internal.IntentRecognitionEventArgs eventArgs)
            {
                var resultEventArg = new IntentRecognitionResultEventArgs(eventArgs);
                var handler = isFinalResultHandler ? recognizer.OnFinalResult : recognizer.OnIntermediateResult;
                if (handler != null)
                {
                    handler(this, resultEventArg);
                }
            }

            private IntentRecognizer recognizer;
            private bool isFinalResultHandler;
        }

        /// <summary>
        /// Defines an internal class to raise a C# event for error during recognition when a corresponding callback is invoked by the native layer.
        /// </summary>
        private class ErrorHandlerImpl : Internal.IntentEventListener
        {
            public ErrorHandlerImpl(IntentRecognizer recognizer)
            {
                this.recognizer = recognizer;
            }

            public override void Execute(Carbon.Internal.IntentRecognitionEventArgs eventArgs)
            {
                var resultEventArg = new RecognitionErrorEventArgs(eventArgs.SessionId, eventArgs.Result.Reason);
                var handler = this.recognizer.OnRecognitionError;

                if (handler != null)
                {
                    handler(this, resultEventArg);
                }
            }

            private IntentRecognizer recognizer;
        }
    }

    
}

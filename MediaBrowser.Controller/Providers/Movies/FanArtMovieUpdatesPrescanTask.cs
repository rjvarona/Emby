﻿using MediaBrowser.Common.Net;
using MediaBrowser.Controller.Configuration;
using MediaBrowser.Controller.Library;
using MediaBrowser.Controller.Providers.Music;
using MediaBrowser.Model.Logging;
using MediaBrowser.Model.Net;
using MediaBrowser.Model.Serialization;
using System;
using System.Collections.Generic;
using System.Globalization;
using System.IO;
using System.Linq;
using System.Text;
using System.Threading;
using System.Threading.Tasks;

namespace MediaBrowser.Controller.Providers.Movies
{
    class FanArtMovieUpdatesPrescanTask : ILibraryPrescanTask
    {
        private const string UpdatesUrl = "http://api.fanart.tv/webservice/newmovies/{0}/{1}/";

        /// <summary>
        /// The _HTTP client
        /// </summary>
        private readonly IHttpClient _httpClient;
        /// <summary>
        /// The _logger
        /// </summary>
        private readonly ILogger _logger;
        /// <summary>
        /// The _config
        /// </summary>
        private readonly IServerConfigurationManager _config;
        private readonly IJsonSerializer _jsonSerializer;

        private static readonly CultureInfo UsCulture = new CultureInfo("en-US");

        public FanArtMovieUpdatesPrescanTask(IJsonSerializer jsonSerializer, IServerConfigurationManager config, ILogger logger, IHttpClient httpClient)
        {
            _jsonSerializer = jsonSerializer;
            _config = config;
            _logger = logger;
            _httpClient = httpClient;
        }

        /// <summary>
        /// Runs the specified progress.
        /// </summary>
        /// <param name="progress">The progress.</param>
        /// <param name="cancellationToken">The cancellation token.</param>
        /// <returns>Task.</returns>
        public async Task Run(IProgress<double> progress, CancellationToken cancellationToken)
        {
            if (!_config.Configuration.EnableInternetProviders)
            {
                progress.Report(100);
                return;
            }

            var path = FanArtMovieProvider.GetMoviesDataPath(_config.CommonApplicationPaths);

            var timestampFile = Path.Combine(path, "time.txt");

            var timestampFileInfo = new FileInfo(timestampFile);

            // Don't check for tvdb updates anymore frequently than 24 hours
            if (timestampFileInfo.Exists && (DateTime.UtcNow - timestampFileInfo.LastWriteTimeUtc).TotalDays < 1)
            {
                return;
            }

            // Find out the last time we queried for updates
            var lastUpdateTime = timestampFileInfo.Exists ? File.ReadAllText(timestampFile, Encoding.UTF8) : string.Empty;

            var existingDirectories = Directory.EnumerateDirectories(path).Select(Path.GetFileName).ToList();

            // If this is our first time, don't do any updates and just record the timestamp
            if (!string.IsNullOrEmpty(lastUpdateTime))
            {
                var moviesToUpdate = await GetMovieIdsToUpdate(existingDirectories, lastUpdateTime, cancellationToken).ConfigureAwait(false);

                progress.Report(5);

                await UpdateMovies(moviesToUpdate, path, progress, cancellationToken).ConfigureAwait(false);
            }

            var newUpdateTime = Convert.ToInt64(DateTimeToUnixTimestamp(DateTime.UtcNow)).ToString(UsCulture);
            
            File.WriteAllText(timestampFile, newUpdateTime, Encoding.UTF8);

            progress.Report(100);
        }

        private async Task<IEnumerable<string>> GetMovieIdsToUpdate(IEnumerable<string> existingIds, string lastUpdateTime, CancellationToken cancellationToken)
        {
            // First get last time
            using (var stream = await _httpClient.Get(new HttpRequestOptions
            {
                Url = string.Format(UpdatesUrl, FanartBaseProvider.ApiKey, lastUpdateTime),
                CancellationToken = cancellationToken,
                EnableHttpCompression = true,
                ResourcePool = FanartBaseProvider.FanArtResourcePool

            }).ConfigureAwait(false))
            {
                // If empty fanart will return a string of "null", rather than an empty list
                using (var reader = new StreamReader(stream))
                {
                    var json = await reader.ReadToEndAsync().ConfigureAwait(false);

                    if (string.Equals(json, "null", StringComparison.OrdinalIgnoreCase))
                    {
                        return new List<string>();
                    }

                    var updates = _jsonSerializer.DeserializeFromString<List<FanArtUpdatesPrescanTask.FanArtUpdate>>(json);

                    return updates.Select(i => i.id).Where(i => existingIds.Contains(i, StringComparer.OrdinalIgnoreCase));
                }
            }
        }

        private async Task UpdateMovies(IEnumerable<string> idList, string moviesDataPath, IProgress<double> progress, CancellationToken cancellationToken)
        {
            var list = idList.ToList();
            var numComplete = 0;

            foreach (var id in list)
            {
                try
                {
                    await UpdateMovie(id, moviesDataPath, cancellationToken).ConfigureAwait(false);
                }
                catch (HttpException ex)
                {
                    // Already logged at lower levels, but don't fail the whole operation, unless something other than a timeout
                    if (!ex.IsTimedOut)
                    {
                        throw;
                    }
                }

                numComplete++;
                double percent = numComplete;
                percent /= list.Count;
                percent *= 95;

                progress.Report(percent + 5);
            }
        }

        private Task UpdateMovie(string tmdbId, string movieDataPath, CancellationToken cancellationToken)
        {
            _logger.Info("Updating movie " + tmdbId);

            movieDataPath = Path.Combine(movieDataPath, tmdbId);

            if (!Directory.Exists(movieDataPath))
            {
                Directory.CreateDirectory(movieDataPath);
            }

            return FanArtMovieProvider.Current.DownloadMovieXml(movieDataPath, tmdbId, cancellationToken);
        }

        /// <summary>
        /// Dates the time to unix timestamp.
        /// </summary>
        /// <param name="dateTime">The date time.</param>
        /// <returns>System.Double.</returns>
        private static double DateTimeToUnixTimestamp(DateTime dateTime)
        {
            return (dateTime - new DateTime(1970, 1, 1).ToUniversalTime()).TotalSeconds;
        }

        public class FanArtUpdate
        {
            public string id { get; set; }
            public string name { get; set; }
            public string new_images { get; set; }
            public string total_images { get; set; }
        }
    }
}

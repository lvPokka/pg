(function () {
    'use strict';

    function addSettingsBackup() {
      if (Lampa.Settings.main && Lampa.Settings.main() && !Lampa.Settings.main().render().find('[data-component="localbackup_mod"]').length) {
        var field = $("<div class=\"settings-folder selector\" data-component=\"localbackup_mod\">\n            <div class=\"settings-folder__icon\">\n                <svg fill=\"#ffffff\" width=\"800px\" height=\"800px\" viewBox=\"0 0 64 64\" data-name=\"Material Expand\" id=\"Material_Expand\" xmlns=\"http://www.w3.org/2000/svg\"><path d=\"M50,16a11.9,11.9,0,0,0-4.149.74,16.992,16.992,0,0,0-33.59-.614A11.992,11.992,0,0,0,11,39.6V44a2,2,0,0,0,2,2H24v4H10v4H24v4H10v4H26a2,2,0,0,0,2-2V46h8V60a2,2,0,0,0,2,2H54V58H40V54H54V50H40V46H51a2,2,0,0,0,2-2V39.6A11.992,11.992,0,0,0,50,16ZM49,42H15V30H49Zm4-6.589V28a2,2,0,0,0-2-2H13a2,2,0,0,0-2,2v7.411A8,8,0,0,1,13.948,20l.1,0a2,2,0,0,0,2-1.868A12.991,12.991,0,0,1,42,19c0,.261-.02.517-.038.772l-.01.142a2,2,0,0,0,3.208,1.73A7.914,7.914,0,0,1,50,20a8,8,0,0,1,3,15.411Z\"/><rect height=\"4\" width=\"4\" x=\"2\" y=\"58\"/><rect height=\"4\" width=\"4\" x=\"2\" y=\"50\"/><rect height=\"4\" width=\"4\" x=\"19\" y=\"34\"/><rect height=\"4\" width=\"18\" x=\"27\" y=\"34\"/><rect height=\"4\" width=\"4\" x=\"58\" y=\"58\"/><rect height=\"4\" width=\"4\" x=\"58\" y=\"50\"/></svg>\n            </div>\n            <div class=\"settings-folder__name\">Local Backup</div>\n        </div>");
        Lampa.Settings.main().render().find('[data-component="more"]').after(field);
        Lampa.Settings.main().update();
      }
    }
	
	if (window.appready) {
		addSettingsBackup(); 
	}
	else 
	{
		Lampa.Listener.follow('app', function (e) {
			if (e.type == 'ready') addSettingsBackup();
		});
    }
	
	Lampa.Settings.listener.follow('open', function (e) {
      if (e.name == 'localbackup_mod') {
		  
		const cub_id = encodeURIComponent(btoa(Lampa.Storage.get('account', '{}').email || 'none'));
		const profile_id = encodeURIComponent(btoa(Lampa.Storage.get('account', '{}').profile.id || 'none'));

		  
		var localbackup_upload = e.body.find('[data-name="localbackup_upload"]');
        localbackup_upload.unbind('hover:enter').on('hover:enter', function () {
			$('.settings-param__status', localbackup_upload).removeClass('active error wait').addClass('wait');
			const data = JSON.stringify(localStorage, null, 2);
			const blob = new Blob([data], { type: "application/json" });
			const formData = new FormData();
			formData.append("file", blob, "localstorage-backup.json");

			fetch("https://pokkahub.ddns.net/lampaback/up.php?a=up&i=" + cub_id + "&p=" + profile_id, {
				method: "POST",
				body: formData
			})
			.then(res => {
				$('.settings-param__status', localbackup_upload).removeClass('active error wait').addClass('active');
			})
			.catch(err => {
				$('.settings-param__status', localbackup_upload).removeClass('active error wait').addClass('error');
				console.error("Backup failed:", err)
			});
			setTimeout(function() {
				$('.settings-param__status', localbackup_upload).removeClass('active error wait')
			}, 1500);
        });
		
		var localbackup_download = e.body.find('[data-name="localbackup_download"]');
        localbackup_download.unbind('hover:enter').on('hover:enter', function () {
          $('.settings-param__status', localbackup_download).removeClass('active error wait').addClass('wait');
		  
		  fetch("https://pokkahub.ddns.net/lampaback/up.php?a=dn&i=" + cub_id + "&p=" + profile_id) // URL, где лежит PHP-скрипт
			.then(response => {
				if (response.ok) {
					return response.json(); // Получаем файл как JSON
				}
				throw new Error('File not found');
			})
			.then(data => {
				// Проверяем, что файл имеет правильный формат
				if (data && typeof data === 'object') {
					Object.keys(data).forEach(key => {
						localStorage.setItem(key, data[key]); // Восстанавливаем данные в localStorage
					});
					$('.settings-param__status', localbackup_download).removeClass('active error wait').addClass('active');
					console.log("LocalStorage восстановлен.");
				} else {
					$('.settings-param__status', localbackup_download).removeClass('active error wait').addClass('error');
					console.error("Некорректный формат файла.");
				}
			})
			.catch(err => {
				$('.settings-param__status', localbackup_download).removeClass('active error wait').addClass('error');
				console.error("Ошибка при получении файла:", err);
			});
	
			setTimeout(function() {
				$('.settings-param__status', localbackup_download).removeClass('active error wait')
			}, 1500);
	
	
        });
		
      }
    });

	var template = "<div>";
	template += "\n<div class=\"settings-param selector\" data-name=\"localbackup_upload\" data-static=\"true\">"+
				"\n<div class=\"settings-param__name\">Отправить</div>\n        <div class=\"settings-param__status\"></div>\n    </div>";
	template += "\n<div class=\"settings-param selector\" data-name=\"localbackup_download\" data-static=\"true\">"+
				"\n<div class=\"settings-param__name\">Востановить</div>\n        <div class=\"settings-param__status\"></div>\n    </div>";
	template += "\n</div>";
    Lampa.Template.add('settings_localbackup_mod', template);
	
})();
